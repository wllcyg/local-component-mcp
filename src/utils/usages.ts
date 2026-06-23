import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { resolveAliasPath } from "../alias.js";
import { scanCodeFiles, extractScriptBlock } from "./files.js";
import { queryImporters } from "./index-cache.js";

const traverse = _traverse.default || _traverse;

export interface MatchInfo {
  lineNumber: number;
  lineContent: string;
  type: "import" | "template" | "script";
}

export interface UsageInfo {
  filePath: string;
  relativeFilePath: string;
  matches: MatchInfo[];
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** 转义 RegExp 元字符，防止组件名含有 $、. 等特殊字符时构造出非法正则 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface ResolvedFile {
  content: string;
  importsComponent: boolean;
  localNames: Set<string>;
}

/**
 * 读取文件一次，同时完成：
 * 1. AST 解析，提取引用了 targetNoExt 的本地变量名
 * 2. 返回文件内容供后续行扫描复用（避免二次读取）
 */
function readAndResolve(
  file: string,
  targetNoExt: string
): ResolvedFile {
  const content = fs.readFileSync(file, "utf-8");
  const fileDir = path.dirname(file);
  let importsComponent = false;
  const localNames = new Set<string>();

  const scriptCode = file.endsWith(".vue") ? extractScriptBlock(content) : content;

  if (scriptCode.trim()) {
    try {
      const ast = babelParser.parse(scriptCode, {
        sourceType: "module",
        plugins: ["typescript", "jsx", "decorators-legacy"],
      });
      traverse(ast, {
        ImportDeclaration(p: any) {
          const resolved = resolveAliasPath(p.node.source.value, fileDir);
          if (resolved.replace(/\.[^/.]+$/, "") === targetNoExt) {
            importsComponent = true;
            p.node.specifiers.forEach((spec: any) => {
              if (
                spec.type === "ImportDefaultSpecifier" ||
                spec.type === "ImportSpecifier"
              ) {
                localNames.add(spec.local.name);
              }
            });
          }
        },
        CallExpression(p: any) {
          if (p.node.callee.type === "Import") {
            const arg = p.node.arguments[0];
            if (arg?.type === "StringLiteral") {
              const resolved = resolveAliasPath(arg.value, fileDir);
              if (resolved.replace(/\.[^/.]+$/, "") === targetNoExt) {
                importsComponent = true;
                // 支持多种动态导入写法，向上爬多层 AST 找到变量名：
                // 1. const X = import('...')  → VariableDeclarator 在 parentPath.parentPath
                // 2. const X = defineAsyncComponent(() => import('...'))
                //    → import 所在 ArrowFunction → CallExpression(defineAsyncComponent) → VariableDeclarator
                let cur: any = p.parentPath;
                let found = false;
                for (let i = 0; i < 6 && cur && !found; i++) {
                  if (
                    cur?.type === "VariableDeclarator" &&
                    cur.node.id?.type === "Identifier"
                  ) {
                    localNames.add(cur.node.id.name);
                    found = true;
                  }
                  cur = cur?.parentPath;
                }
              }
            }
          }
        },
      });
    } catch {
      // 忽略解析失败
    }
  }

  return { content, importsComponent, localNames };
}

/**
 * 逐行扫描文件内容，匹配组件的模板/脚本引用，返回匹配列表
 * Bug Fix: import 行和 script 行互斥，不会重复报告同一行
 */
function scanFileLines(
  content: string,
  importsComponent: boolean,
  localNames: Set<string>,
  targetBaseName: string
): MatchInfo[] {
  const lines = content.split(/\r?\n/);
  const matches: MatchInfo[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineNumber = idx + 1;
    let matched = false;

    // 优先匹配 import 行（排他性：import 行不再参与 script/template 匹配）
    if (line.includes("import")) {
      if (
        importsComponent &&
        (line.includes(targetBaseName) ||
          Array.from(localNames).some((n) => line.includes(n)))
      ) {
        matches.push({ lineNumber, lineContent: line, type: "import" });
        continue; // 已匹配为 import，跳过后续规则
      }
      // 非目标组件的 import 行，跳过（不做 template/script 匹配）
      continue;
    }

    for (const localName of localNames) {
      const kebab = toKebabCase(localName);

      // 匹配模板标签调用
      if (line.includes(`<${localName}`) || line.includes(`<${kebab}`)) {
        matches.push({ lineNumber, lineContent: line, type: "template" });
        matched = true;
        break;
      }

      // 匹配 :is="..." 动态组件
      if (
        line.includes(`:is="${localName}"`) ||
        line.includes(`:is="'${localName}'"`) ||
        line.includes(`:is="'${kebab}'"`)
      ) {
        matches.push({ lineNumber, lineContent: line, type: "template" });
        matched = true;
        break;
      }

      // 匹配脚本逻辑调用（排除 export/components 注册行）
      if (!line.includes("export") && !line.includes("components:")) {
        if (new RegExp(`\\b${escapeRegex(localName)}\\b`).test(line)) {
          matches.push({ lineNumber, lineContent: line, type: "script" });
          matched = true;
          break;
        }
      }

      if (matched) break;
    }
  }

  return matches;
}

/**
 * 在 projectRoot 范围内找到所有引用了 targetPath 组件的文件及具体行号
 * 使用内存索引优先过滤候选文件，大幅减少全量文件扫描次数
 */
export function findComponentUsages(targetPath: string, projectRoot: string): UsageInfo[] {
  const targetAbs = path.resolve(targetPath);
  const targetNoExt = targetAbs.replace(/\.[^/.]+$/, "");
  let targetBaseName = path.basename(targetAbs, path.extname(targetAbs));
  if (targetBaseName.toLowerCase() === "index") {
    // 如果文件名是 index，则向上取父级目录名称作为真实的组件名 (如 ImageUpload)
    targetBaseName = path.basename(path.dirname(targetAbs));
  }

  // Step 1: 通过索引快速获取所有 import 了该组件的文件（精确命中）
  const importers = new Set(queryImporters(projectRoot, targetNoExt));

  // Step 2: 全量文件列表（排除目标文件自身）
  const allFiles = scanCodeFiles(projectRoot).filter((f) => f !== targetAbs);

  const usages: UsageInfo[] = [];

  for (const file of allFiles) {
    try {
      const isImporter = importers.has(file);

      let content: string;
      let importsComponent: boolean;
      let localNames: Set<string>;

      if (isImporter) {
        // 一次读取，同时完成 AST 解析 + 获取文件内容
        const resolved = readAndResolve(file, targetNoExt);
        content = resolved.content;
        importsComponent = resolved.importsComponent;
        localNames = resolved.localNames;
        if (localNames.size === 0) localNames.add(targetBaseName);
      } else {
        // 全局注册的组件：直接读取内容，用原始组件名扫描模板
        content = fs.readFileSync(file, "utf-8");
        importsComponent = false;
        localNames = new Set([targetBaseName]);
      }

      const matches = scanFileLines(content, importsComponent, localNames, targetBaseName);

      // 对非 importer 文件，只保留 template 类型（避免误报脚本噪音）
      const filteredMatches = isImporter
        ? matches
        : matches.filter((m) => m.type === "template");

      if (filteredMatches.length > 0) {
        usages.push({
          filePath: file,
          relativeFilePath: path.relative(projectRoot, file),
          matches: filteredMatches,
        });
      }
    } catch (error) {
      console.error(`处理文件引用时出错 ${file}:`, error);
    }
  }

  return usages;
}
