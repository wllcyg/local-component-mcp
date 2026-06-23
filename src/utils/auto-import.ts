import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";

const traverse = _traverse.default || _traverse;

export interface AutoImportConfig {
  /** 所有自动注册的组件名 → 文件绝对路径 */
  components: Map<string, string>;
}

const cache = new Map<string, { mtime: number; config: AutoImportConfig }>();

function fileMtime(p: string): number {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

/** 从 vite.config.ts/js 中解析 unplugin-vue-components 的 dirs 配置 */
function parseViteConfig(viteConfigPath: string, projectRoot: string): string[] {
  let code: string;
  try { code = fs.readFileSync(viteConfigPath, "utf-8"); } catch { return []; }

  let ast: any;
  try {
    ast = babelParser.parse(code, {
      sourceType: "module",
      plugins: ["typescript"],
    });
  } catch {
    return [];
  }

  const componentDirs: string[] = [];

  traverse(ast, {
    CallExpression(p: any) {
      // 找到 Components({ dirs: [...] }) 或 VueComponents({ dirs: [...] })
      const callee = p.node.callee;
      const calleeName: string =
        callee?.name ||
        callee?.property?.name ||
        "";

      if (!/^(Components|VueComponents|AutoImport)$/i.test(calleeName)) return;

      const arg = p.node.arguments[0];
      if (arg?.type !== "ObjectExpression") return;

      for (const prop of arg.properties) {
        if (
          prop.type === "ObjectProperty" &&
          (prop.key?.name === "dirs" || prop.key?.value === "dirs")
        ) {
          const val = prop.value;
          if (val.type === "ArrayExpression") {
            for (const el of val.elements) {
              if (el?.type === "StringLiteral") {
                const dir = path.resolve(projectRoot, el.value);
                componentDirs.push(dir);
              }
            }
          } else if (val.type === "StringLiteral") {
            componentDirs.push(path.resolve(projectRoot, val.value));
          }
        }
      }
    },
  });

  return componentDirs;
}

/** 递归扫描目录下所有组件文件，建立 ComponentName → filePath 映射 */
function scanComponentsDir(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  const SKIP = new Set(["node_modules", ".git", "dist", "build"]);

  const walk = (d: string) => {
    let entries: string[];
    try { entries = fs.readdirSync(d); } catch { return; }

    for (const file of entries) {
      const fullPath = path.join(d, file);
      let stat: fs.Stats;
      try { stat = fs.statSync(fullPath); } catch { continue; }

      if (stat.isDirectory()) {
        if (!SKIP.has(file)) walk(fullPath);
      } else {
        const ext = path.extname(file);
        if ([".vue", ".tsx", ".jsx"].includes(ext)) {
          const name = path.basename(file, ext);
          // PascalCase name as key
          map.set(name, fullPath);
        }
      }
    }
  };

  walk(dir);
  return map;
}

/**
 * 读取项目的 auto-import 配置，返回自动注册的组件映射
 * 结果按 vite.config 的 mtime 缓存
 */
export function getAutoImportConfig(projectRoot: string): AutoImportConfig {
  const viteConfigCandidates = [
    path.join(projectRoot, "vite.config.ts"),
    path.join(projectRoot, "vite.config.js"),
  ];

  const viteConfig = viteConfigCandidates.find(fs.existsSync);
  const mtime = viteConfig ? fileMtime(viteConfig) : 0;

  const cached = cache.get(projectRoot);
  if (cached && cached.mtime === mtime) return cached.config;

  const config: AutoImportConfig = { components: new Map() };

  if (viteConfig) {
    const dirs = parseViteConfig(viteConfig, projectRoot);

    // Fallback：如果解析不到 dirs，使用约定的 src/components
    const effectiveDirs = dirs.length > 0
      ? dirs
      : [path.join(projectRoot, "src", "components")];

    for (const dir of effectiveDirs) {
      if (!fs.existsSync(dir)) continue;
      for (const [name, filePath] of scanComponentsDir(dir)) {
        config.components.set(name, filePath);
      }
    }
  }

  cache.set(projectRoot, { mtime, config });
  return config;
}
