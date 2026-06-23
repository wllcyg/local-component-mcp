import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";

const traverse = _traverse.default || _traverse;

export interface AliasRule {
  find: string;
  replacement: string;
}

interface AliasCacheEntry {
  rules: AliasRule[];
  // mtime of each config file that contributed to these rules
  mtimes: Map<string, number>;
}

// mtime-aware in-memory cache, keyed by project root
const projectAliasCache = new Map<string, AliasCacheEntry>();

/** Returns mtime (ms) of a file, or 0 if it doesn't exist */
function fileMtime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/** Returns all candidate config file paths for a project root */
function configFilePaths(projectRoot: string): string[] {
  return [
    path.join(projectRoot, "tsconfig.json"),
    path.join(projectRoot, "tsconfig.app.json"),
    path.join(projectRoot, "vite.config.ts"),
    path.join(projectRoot, "vite.config.js"),
    path.join(projectRoot, "vue.config.js"),
  ];
}

/** Returns true if any cached config file mtime has changed */
function isCacheStale(entry: AliasCacheEntry, projectRoot: string): boolean {
  for (const [file, mtime] of entry.mtimes) {
    if (fileMtime(file) !== mtime) return true;
  }
  // Also check if a new config file appeared that wasn't there before
  for (const file of configFilePaths(projectRoot)) {
    if (!entry.mtimes.has(file) && fs.existsSync(file)) return true;
  }
  return false;
}

/**
 * Finds the project root by traversing upwards until package.json is found.
 * If not found, returns null.
 */
export function findProjectRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      return dir;
    }
    const parentDir = path.dirname(dir);
    if (parentDir === dir) {
      break;
    }
    dir = parentDir;
  }
  return null;
}

/**
 * Strips line and block comments from a JSON/tsconfig string.
 */
function stripComments(jsonString: string): string {
  return jsonString.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
}

/**
 * Resolves a tsconfig path pattern.
 */
function resolveTsconfigPattern(projectRoot: string, baseUrl: string, pattern: string): string {
  if (pattern.includes("*")) {
    const starIndex = pattern.indexOf("*");
    const beforeStar = pattern.slice(0, starIndex);
    const afterStar = pattern.slice(starIndex + 1);
    let resolvedBefore = path.resolve(projectRoot, baseUrl, beforeStar);
    if (beforeStar.endsWith("/") && !resolvedBefore.endsWith("/")) {
      resolvedBefore += "/";
    }
    return resolvedBefore + "*" + afterStar;
  }
  return path.resolve(projectRoot, baseUrl, pattern);
}

/**
 * Helper to statically evaluate path AST nodes for vite/webpack configurations.
 */
function evaluatePathNode(node: any, configDir: string): string | null {
  if (node.type === "StringLiteral") {
    const val = node.value;
    return path.isAbsolute(val) ? val : path.resolve(configDir, val);
  }
  if (node.type === "TemplateLiteral") {
    if (node.expressions.length === 0 && node.quasis.length === 1) {
      const val = node.quasis[0].value.cooked;
      return path.isAbsolute(val) ? val : path.resolve(configDir, val);
    }
  }
  if (node.type === "CallExpression") {
    const stringArgs: string[] = [];
    for (const arg of node.arguments) {
      if (arg.type === "StringLiteral") {
        stringArgs.push(arg.value);
      } else if (arg.type === "Identifier" && arg.name === "__dirname") {
        stringArgs.push(configDir);
      }
    }
    if (stringArgs.length > 0) {
      if (stringArgs[0] === configDir) {
        return path.resolve(...stringArgs);
      }
      return path.resolve(configDir, ...stringArgs);
    }
  }
  return null;
}

/**
 * Extracts alias rules from JS/TS config code via AST.
 */
function extractAliasesFromJsTs(code: string, configDir: string): AliasRule[] {
  const rules: AliasRule[] = [];
  try {
    const ast = babelParser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "decorators-legacy"],
    });

    traverse(ast, {
      ObjectProperty(p: any) {
        const keyName = p.node.key.name || p.node.key.value;
        if (keyName === "alias") {
          const valueNode = p.node.value;
          if (valueNode.type === "ObjectExpression") {
            // alias: { '@': './src' }
            valueNode.properties.forEach((prop: any) => {
              if (prop.type === "ObjectProperty") {
                const propKey = prop.key.name || prop.key.value;
                const evaluated = evaluatePathNode(prop.value, configDir);
                if (propKey && evaluated) {
                  rules.push({ find: propKey, replacement: evaluated });
                }
              }
            });
          } else if (valueNode.type === "ArrayExpression") {
            // alias: [ { find: '@', replacement: './src' } ]
            valueNode.elements.forEach((elem: any) => {
              if (elem && elem.type === "ObjectExpression") {
                let findVal: string | null = null;
                let replacementVal: string | null = null;
                elem.properties.forEach((prop: any) => {
                  if (prop.type === "ObjectProperty") {
                    const propKey = prop.key.name || prop.key.value;
                    if (propKey === "find") {
                      if (prop.value.type === "StringLiteral") {
                        findVal = prop.value.value;
                      } else if (prop.value.type === "RegExpLiteral") {
                        // 用特殊前缀标记这是正则别名，方便 matchAlias 区分处理
                        findVal = "__REGEX__:" + prop.value.pattern;
                      }
                    } else if (propKey === "replacement") {
                      replacementVal = evaluatePathNode(prop.value, configDir);
                    }
                  }
                });
                if (findVal && replacementVal) {
                  rules.push({ find: findVal, replacement: replacementVal });
                }
              }
            });
          }
        }
      },
    });
  } catch (error) {
    console.error("Failed to parse JS/TS config via AST:", error);
  }
  return rules;
}

/**
 * Loads alias rules from tsconfig.json / tsconfig.app.json
 */
function loadTsConfigRules(projectRoot: string): AliasRule[] | null {
  const pathsToCheck = [
    path.join(projectRoot, "tsconfig.json"),
    path.join(projectRoot, "tsconfig.app.json"),
  ];

  for (const tsconfigPath of pathsToCheck) {
    if (fs.existsSync(tsconfigPath)) {
      try {
        const content = fs.readFileSync(tsconfigPath, "utf8");
        const tsconfig = JSON.parse(stripComments(content));
        const compilerOptions = tsconfig.compilerOptions || {};
        const baseUrl = compilerOptions.baseUrl || ".";
        const paths = compilerOptions.paths || {};

        const rules: AliasRule[] = [];
        for (const [key, values] of Object.entries(paths)) {
          if (Array.isArray(values) && values.length > 0) {
            const resolvedValue = resolveTsconfigPattern(projectRoot, baseUrl, values[0]);
            rules.push({ find: key, replacement: resolvedValue });
          }
        }
        if (rules.length > 0) {
          return rules;
        }
      } catch (error) {
        console.error(`Error parsing tsconfig at ${tsconfigPath}:`, error);
      }
    }
  }
  return null;
}

/**
 * Loads alias rules from vite.config.ts / vite.config.js
 */
function loadViteConfigRules(projectRoot: string): AliasRule[] | null {
  const pathsToCheck = [
    path.join(projectRoot, "vite.config.ts"),
    path.join(projectRoot, "vite.config.js"),
  ];

  for (const configPath of pathsToCheck) {
    if (fs.existsSync(configPath)) {
      try {
        const code = fs.readFileSync(configPath, "utf8");
        const rules = extractAliasesFromJsTs(code, projectRoot);
        if (rules.length > 0) {
          return rules;
        }
      } catch (error) {
        console.error(`Error parsing vite config at ${configPath}:`, error);
      }
    }
  }
  return null;
}

/**
 * Loads alias rules from vue.config.js
 */
function loadVueConfigRules(projectRoot: string): AliasRule[] | null {
  const configPath = path.join(projectRoot, "vue.config.js");
  if (fs.existsSync(configPath)) {
    try {
      const code = fs.readFileSync(configPath, "utf8");
      const rules = extractAliasesFromJsTs(code, projectRoot);
      if (rules.length > 0) {
        return rules;
      }
    } catch (error) {
      console.error(`Error parsing vue config at ${configPath}:`, error);
    }
  }
  return null;
}

/**
 * Returns default alias rules pointing to <projectRoot>/src
 */
function defaultRules(projectRoot: string): AliasRule[] {
  const srcPath = path.resolve(projectRoot, "src");
  return [
    { find: "@/*", replacement: srcPath + "/*" },
    { find: "~/*", replacement: srcPath + "/*" },
    { find: "@", replacement: srcPath },
    { find: "~", replacement: srcPath },
  ];
}

/**
 * Gets alias rules for the given project root, with priorities:
 * 1. tsconfig.json / tsconfig.app.json
 * 2. vite.config.ts / vite.config.js
 * 3. vue.config.js
 * 4. Default fallback: @ and ~ point to src/
 */
export function getAliasRules(projectRoot: string): AliasRule[] {
  const cached = projectAliasCache.get(projectRoot);
  if (cached && !isCacheStale(cached, projectRoot)) {
    return cached.rules;
  }

  // (Re-)load rules
  let rules: AliasRule[] = [];

  const tsconfigRules = loadTsConfigRules(projectRoot);
  if (tsconfigRules && tsconfigRules.length > 0) {
    rules = tsconfigRules;
  } else {
    const viteRules = loadViteConfigRules(projectRoot);
    if (viteRules && viteRules.length > 0) {
      rules = viteRules;
    } else {
      const vueRules = loadVueConfigRules(projectRoot);
      if (vueRules && vueRules.length > 0) {
        rules = vueRules;
      }
    }
  }

  if (rules.length === 0) {
    rules = defaultRules(projectRoot);
  }

  // Sort rules: longer/more specific find patterns first
  rules.sort((a, b) => b.find.length - a.find.length);

  // Record current mtimes for all candidate config files
  const mtimes = new Map<string, number>();
  for (const file of configFilePaths(projectRoot)) {
    mtimes.set(file, fileMtime(file));
  }

  projectAliasCache.set(projectRoot, { rules, mtimes });
  return rules;
}

/**
 * Matches a path against a rule. Returns resolved path if matched, null otherwise.
 */
export function matchAlias(input: string, find: string, replacement: string): string | null {
  // 处理 Vite 正则表达式别名，例如 find: /^\/src/
  if (find.startsWith("__REGEX__:")) {
    const pattern = find.slice("__REGEX__:".length);
    try {
      const regex = new RegExp(pattern);
      if (regex.test(input)) {
        return input.replace(regex, replacement);
      }
    } catch {
      // 无效正则，直接跳过
    }
    return null;
  }

  if (input === find) {
    return replacement;
  }
  if (input.startsWith(find + "/")) {
    const suffix = input.slice(find.length); // includes leading slash
    return path.join(replacement, suffix);
  }
  if (find.includes("*")) {
    const parts = find.split("*");
    if (parts.length === 2) {
      const [prefix, suffix] = parts;
      if (input.startsWith(prefix) && input.endsWith(suffix)) {
        const wildcardValue = input.slice(prefix.length, input.length - suffix.length);
        const replacementParts = replacement.split("*");
        if (replacementParts.length === 2) {
          return replacementParts[0] + wildcardValue + replacementParts[1];
        }
        return replacement.replace("*", wildcardValue);
      }
    }
  }
  return null;
}

/**
 * Resolves a file path by testing common extensions (.ts, .tsx, .js, .jsx, .vue) and index files.
 */
export function resolveFileExtension(filePath: string): string {
  if (fs.existsSync(filePath)) {
    if (fs.statSync(filePath).isDirectory()) {
      const exts = [".ts", ".tsx", ".js", ".jsx", ".vue"];
      for (const ext of exts) {
        const indexWithExt = path.join(filePath, "index" + ext);
        if (fs.existsSync(indexWithExt)) {
          return indexWithExt;
        }
      }
    }
    return filePath;
  }
  const exts = [".ts", ".tsx", ".js", ".jsx", ".vue"];
  for (const ext of exts) {
    const withExt = filePath + ext;
    if (fs.existsSync(withExt)) {
      return withExt;
    }
  }
  for (const ext of exts) {
    const indexWithExt = path.join(filePath, "index" + ext);
    if (fs.existsSync(indexWithExt)) {
      return indexWithExt;
    }
  }
  return filePath;
}

/**
 * Resolves an input path to an absolute path if it contains an alias.
 * If inputPath is already absolute, returns it directly.
 */
export function resolveAliasPath(inputPath: string, startDir: string): string {
  if (path.isAbsolute(inputPath)) {
    return resolveFileExtension(inputPath);
  }

  const projectRoot = findProjectRoot(startDir) || startDir;
  const rules = getAliasRules(projectRoot);

  for (const rule of rules) {
    const resolved = matchAlias(inputPath, rule.find, rule.replacement);
    if (resolved) {
      const absPath = path.isAbsolute(resolved) ? resolved : path.resolve(projectRoot, resolved);
      return resolveFileExtension(absPath);
    }
  }

  // Also resolve relative paths relative to startDir/projectRoot and check extensions
  const relativeAbs = path.resolve(startDir, inputPath);
  const resolvedRelative = resolveFileExtension(relativeAbs);
  if (fs.existsSync(resolvedRelative)) {
    return resolvedRelative;
  }

  return inputPath;
}

/**
 * Checks if the path is likely to contain a path alias.
 */
export function isLikelyAliasPath(filePath: string): boolean {
  if (path.isAbsolute(filePath)) return false;
  if (filePath.startsWith("@") || filePath.startsWith("~")) return true;
  if (!filePath.startsWith(".") && filePath.includes("/")) return true;
  return false;
}
