import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { resolveAliasPath } from "../alias.js";
import { extractScriptBlock } from "./files.js";

const traverse = _traverse.default || _traverse;

export interface ComponentTreeNode {
  name: string;
  filePath: string;
  relativeFilePath: string;
  /** 在父文件中的导入路径 */
  importedAs: string;
  children: ComponentTreeNode[];
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);
const COMPONENT_EXTS = new Set([".vue", ".tsx", ".jsx"]);

/** 判断一个导入路径是否指向组件（相对路径 or 别名路径，且扩展名为组件文件） */
function isComponentImport(source: string, resolvedPath: string): boolean {
  if (!source.startsWith(".") && !source.startsWith("@") && !source.startsWith("~") && !source.startsWith("#")) {
    // 看起来是 npm 包，跳过
    return false;
  }
  const ext = path.extname(resolvedPath);
  if (COMPONENT_EXTS.has(ext)) return true;

  // 无扩展名时，尝试常见后缀
  for (const e of [".vue", ".tsx", ".jsx"]) {
    if (fs.existsSync(resolvedPath + e)) return true;
  }
  // 目录 index 文件
  for (const e of [".vue", ".tsx", ".jsx"]) {
    if (fs.existsSync(path.join(resolvedPath, `index${e}`))) return true;
  }
  return false;
}

/** 补全无扩展名路径 → 真实绝对路径 */
function resolveToExistingFile(resolvedPath: string): string | null {
  if (fs.existsSync(resolvedPath) && !fs.statSync(resolvedPath).isDirectory()) {
    return resolvedPath;
  }
  for (const e of [".vue", ".tsx", ".jsx", ".ts", ".js"]) {
    if (fs.existsSync(resolvedPath + e)) return resolvedPath + e;
  }
  for (const e of [".vue", ".tsx", ".jsx", ".ts", ".js"]) {
    const indexPath = path.join(resolvedPath, `index${e}`);
    if (fs.existsSync(indexPath)) return indexPath;
  }
  return null;
}

interface ImportedComponent {
  localName: string;
  resolvedFile: string;
  importSource: string;
}

/** 从文件中提取所有组件 import（过滤掉 npm 包） */
function extractComponentImports(
  filePath: string,
  projectRoot: string
): ImportedComponent[] {
  const results: ImportedComponent[] = [];
  const fileDir = path.dirname(filePath);

  let code: string;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    code = filePath.endsWith(".vue") ? extractScriptBlock(raw) : raw;
    if (!code.trim()) return results;
  } catch {
    return results;
  }

  let ast: any;
  try {
    ast = babelParser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy"],
    });
  } catch {
    return results;
  }

  traverse(ast, {
    ImportDeclaration(p: any) {
      const source: string = p.node.source.value;
      const resolved = resolveAliasPath(source, fileDir);
      if (!isComponentImport(source, resolved)) return;

      const realFile = resolveToExistingFile(resolved);
      if (!realFile) return;

      for (const spec of p.node.specifiers) {
        if (
          spec.type === "ImportDefaultSpecifier" ||
          spec.type === "ImportSpecifier"
        ) {
          results.push({
            localName: spec.local.name,
            resolvedFile: realFile,
            importSource: source,
          });
        }
      }
    },
  });

  return results;
}

/** 递归构建组件树（visited 防止循环引用） */
function buildTree(
  filePath: string,
  importedAs: string,
  projectRoot: string,
  visited: Set<string>,
  depth: number,
  maxDepth: number
): ComponentTreeNode {
  const name = path.basename(filePath, path.extname(filePath));

  const node: ComponentTreeNode = {
    name,
    filePath,
    relativeFilePath: path.relative(projectRoot, filePath),
    importedAs,
    children: [],
  };

  if (depth >= maxDepth || visited.has(filePath)) return node;
  visited.add(filePath);

  const imports = extractComponentImports(filePath, projectRoot);
  for (const imp of imports) {
    const child = buildTree(
      imp.resolvedFile,
      imp.localName,
      projectRoot,
      new Set(visited), // 每条分支独立 visited，允许同一组件被不同父组件引用
      depth + 1,
      maxDepth
    );
    node.children.push(child);
  }

  return node;
}

/**
 * 分析一个页面文件，返回其完整组件树
 * @param pageFilePath 页面文件绝对路径
 * @param projectRoot  项目根目录
 * @param maxDepth     最大递归深度（默认 5）
 */
export function analyzePageTree(
  pageFilePath: string,
  projectRoot: string,
  maxDepth = 5
): ComponentTreeNode {
  return buildTree(pageFilePath, path.basename(pageFilePath), projectRoot, new Set(), 0, maxDepth);
}
