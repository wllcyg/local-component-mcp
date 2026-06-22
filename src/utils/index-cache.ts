import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { resolveAliasPath } from "../alias.js";
import { scanCodeFiles, extractScriptBlock } from "./files.js";

const traverse = _traverse.default || _traverse;

interface FileIndexEntry {
  /** 文件上次被索引时的 mtime */
  mtime: number;
  /** 该文件所有导入的路径（绝对路径，无扩展名）*/
  importedPaths: Set<string>;
}

/** 项目根 → 文件索引 */
const projectIndexCache = new Map<string, Map<string, FileIndexEntry>>();

/**
 * 对单个文件提取 import 路径（去掉扩展名以便比较），若已有缓存且 mtime 未变则跳过
 */
function indexFile(
  file: string,
  fileDir: string,
  index: Map<string, FileIndexEntry>
): void {
  const mtime = (() => {
    try { return fs.statSync(file).mtimeMs; } catch { return 0; }
  })();

  const cached = index.get(file);
  if (cached && cached.mtime === mtime) return; // 未变化，跳过

  const importedPaths = new Set<string>();
  try {
    const code = fs.readFileSync(file, "utf-8");
    const scriptCode = file.endsWith(".vue") ? extractScriptBlock(code) : code;
    if (scriptCode.trim()) {
      const ast = babelParser.parse(scriptCode, {
        sourceType: "module",
        plugins: ["typescript", "jsx", "decorators-legacy"],
      });
      traverse(ast, {
        ImportDeclaration(p: any) {
          const resolved = resolveAliasPath(p.node.source.value, fileDir);
          importedPaths.add(resolved.replace(/\.[^/.]+$/, ""));
        },
        CallExpression(p: any) {
          if (p.node.callee.type === "Import") {
            const arg = p.node.arguments[0];
            if (arg?.type === "StringLiteral") {
              const resolved = resolveAliasPath(arg.value, fileDir);
              importedPaths.add(resolved.replace(/\.[^/.]+$/, ""));
            }
          }
        },
      });
    }
  } catch {
    // 解析失败，importedPaths 保持空集合
  }
  index.set(file, { mtime, importedPaths });
}

/**
 * 为 projectRoot 构建/增量更新内存索引
 */
export function buildIndex(projectRoot: string): Map<string, FileIndexEntry> {
  if (!projectIndexCache.has(projectRoot)) {
    projectIndexCache.set(projectRoot, new Map());
  }
  const index = projectIndexCache.get(projectRoot)!;
  const files = scanCodeFiles(projectRoot);

  // 删除已经不存在的文件条目
  const fileSet = new Set(files);
  for (const key of index.keys()) {
    if (!fileSet.has(key)) index.delete(key);
  }

  // 新增/更新条目
  for (const file of files) {
    indexFile(file, path.dirname(file), index);
  }
  return index;
}

/**
 * 查询哪些文件引用了 targetNoExt（无扩展名绝对路径）
 */
export function queryImporters(
  projectRoot: string,
  targetNoExt: string
): string[] {
  const index = buildIndex(projectRoot);
  const result: string[] = [];
  for (const [file, entry] of index) {
    if (entry.importedPaths.has(targetNoExt)) {
      result.push(file);
    }
  }
  return result;
}
