import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { resolveAliasPath } from "../alias.js";
import { extractScriptBlock } from "./files.js";

const traverse = _traverse.default || _traverse;

export interface ImportInfo {
  source: string;
  resolved: string;
}

/**
 * 提取文件中所有的 import 语句，并将路径（含别名）解析为绝对路径
 */
export function extractImports(filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  try {
    const code = fs.readFileSync(filePath, "utf-8");
    let scriptCode = filePath.endsWith(".vue") ? extractScriptBlock(code) : code;

    if (!scriptCode.trim()) return imports;

    const ast = babelParser.parse(scriptCode, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy"],
    });

    const dir = path.dirname(filePath);

    traverse(ast, {
      ImportDeclaration(p: any) {
        const source = p.node.source.value;
        imports.push({ source, resolved: resolveAliasPath(source, dir) });
      },
      CallExpression(p: any) {
        if (p.node.callee.type === "Import") {
          const arg = p.node.arguments[0];
          if (arg?.type === "StringLiteral") {
            const source = arg.value;
            imports.push({ source, resolved: resolveAliasPath(source, dir) });
          }
        }
      },
    });
  } catch (error) {
    console.error(`Failed to extract imports from ${filePath}:`, error);
  }
  return imports;
}
