import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { extractScriptBlock } from "./files.js";

const traverse = _traverse.default || _traverse;

export interface TypeMemberInfo {
  name: string;
  type: string;
  optional: boolean;
  description: string;
}

export interface TypeDefinitionInfo {
  name: string;
  kind: "interface" | "type" | "enum";
  filePath: string;
  description: string;
  members: TypeMemberInfo[];
  /** 对于 type alias，存储原始类型字符串 */
  typeAlias?: string;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);
const TYPES_DIR_PATTERN = /^(types?|interfaces?|models?|dtos?|schemas?)$/i;

/** 递归扫描类型文件 */
export function scanTypeFiles(dir: string, fileList: string[] = []): string[] {
  let entries: string[];
  try { entries = fs.readdirSync(dir); } catch { return fileList; }

  for (const file of entries) {
    const filePath = path.join(dir, file);
    let stat: fs.Stats;
    try { stat = fs.statSync(filePath); } catch { continue; }

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(file)) continue;
      scanTypeFiles(filePath, fileList);
    } else {
      // 收集：types*/ 目录下的 .ts，或文件名含 types/interfaces/models 的 .ts 文件
      const parentDir = path.basename(path.dirname(filePath));
      const isInTypeDir = TYPES_DIR_PATTERN.test(parentDir);
      const isTypeFile = /\.(types?|interface|model|dto|schema)\.tsx?$/.test(file);

      if ((isInTypeDir || isTypeFile) && file.endsWith(".ts") && !file.endsWith(".d.ts")) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

/** 将 TSType 节点转字符串（复用 composables.ts 的逻辑，局部实现以避免循环依赖）*/
function typeToString(ta: any): string {
  if (!ta) return "any";
  const node = ta.typeAnnotation ?? ta;
  if (!node) return "any";

  switch (node.type) {
    case "TSStringKeyword": return "string";
    case "TSNumberKeyword": return "number";
    case "TSBooleanKeyword": return "boolean";
    case "TSAnyKeyword": return "any";
    case "TSVoidKeyword": return "void";
    case "TSNeverKeyword": return "never";
    case "TSUnknownKeyword": return "unknown";
    case "TSUndefinedKeyword": return "undefined";
    case "TSNullKeyword": return "null";
    case "TSArrayType": return `${typeToString(node.elementType)}[]`;
    case "TSTypeReference":
      if (node.typeName?.type === "Identifier") {
        const args = node.typeParameters?.params;
        if (args?.length) return `${node.typeName.name}<${args.map(typeToString).join(", ")}>`;
        return node.typeName.name;
      }
      return "object";
    case "TSUnionType": return (node.types || []).map(typeToString).join(" | ");
    case "TSIntersectionType": return (node.types || []).map(typeToString).join(" & ");
    case "TSLiteralType":
      if (node.literal?.type === "StringLiteral") return `"${node.literal.value}"`;
      if (node.literal?.type === "NumericLiteral") return String(node.literal.value);
      if (node.literal?.type === "BooleanLiteral") return String(node.literal.value);
      return "literal";
    case "TSTypeLiteral": return "{ ... }";
    case "TSFunctionType": return "(...) => ...";
    case "TSOptionalType": return `${typeToString(node.typeAnnotation)}?`;
    case "TSTupleType": return `[${(node.elementTypes || []).map(typeToString).join(", ")}]`;
    default: return "any";
  }
}

function extractJsDocDescription(node: any): string {
  if (!node.leadingComments) return "";
  for (const comment of [...node.leadingComments].reverse()) {
    if (comment.type === "CommentBlock") {
      const lines = comment.value.split("\n").map((l: string) =>
        l.replace(/^\s*\*\s?/, "").trim()
      );
      return lines.filter((l: string) => l && !l.startsWith("@")).join(" ").trim();
    }
  }
  return "";
}

function extractMemberDescription(node: any): string {
  if (node.leadingComments) {
    for (const c of node.leadingComments) {
      if (c.type === "CommentBlock") {
        return c.value.split("\n").map((l: string) => l.replace(/^\s*\*\s?/, "").trim())
          .filter(Boolean).join(" ").trim();
      }
      if (c.type === "CommentLine") {
        return c.value.trim();
      }
    }
  }
  return "";
}

/** 解析单个 .ts 文件，提取所有 interface / type alias / enum 定义 */
export function parseTypeFile(filePath: string): TypeDefinitionInfo[] {
  const results: TypeDefinitionInfo[] = [];

  let code: string;
  try {
    code = fs.readFileSync(filePath, "utf-8");
    if (!code.trim()) return results;
  } catch {
    return results;
  }

  let ast: any;
  try {
    ast = babelParser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "decorators-legacy"],
      attachComment: true,
    });
  } catch {
    return results;
  }

  const processDecl = (decl: any, leadingNode: any) => {
    if (!decl) return;

    // interface Foo { ... }
    if (decl.type === "TSInterfaceDeclaration") {
      const members: TypeMemberInfo[] = [];
      for (const member of decl.body?.body || []) {
        if (member.type === "TSPropertySignature") {
          members.push({
            name: member.key?.name || member.key?.value || "?",
            type: typeToString(member.typeAnnotation),
            optional: !!member.optional,
            description: extractMemberDescription(member),
          });
        }
      }
      results.push({
        name: decl.id?.name || "?",
        kind: "interface",
        filePath,
        description: extractJsDocDescription(leadingNode ?? decl),
        members,
      });
    }

    // type Foo = { ... } | string | ...
    if (decl.type === "TSTypeAliasDeclaration") {
      const members: TypeMemberInfo[] = [];
      if (decl.typeAnnotation?.type === "TSTypeLiteral") {
        for (const member of decl.typeAnnotation.members || []) {
          if (member.type === "TSPropertySignature") {
            members.push({
              name: member.key?.name || member.key?.value || "?",
              type: typeToString(member.typeAnnotation),
              optional: !!member.optional,
              description: extractMemberDescription(member),
            });
          }
        }
      }
      results.push({
        name: decl.id?.name || "?",
        kind: "type",
        filePath,
        description: extractJsDocDescription(leadingNode ?? decl),
        members,
        typeAlias: members.length === 0 ? typeToString(decl.typeAnnotation) : undefined,
      });
    }

    // enum Foo { A, B, C }
    if (decl.type === "TSEnumDeclaration") {
      const members: TypeMemberInfo[] = (decl.members || []).map((m: any) => ({
        name: m.id?.name || m.id?.value || "?",
        type: m.initializer
          ? (m.initializer.type === "StringLiteral"
            ? `"${m.initializer.value}"`
            : String(m.initializer.value ?? ""))
          : "",
        optional: false,
        description: extractMemberDescription(m),
      }));
      results.push({
        name: decl.id?.name || "?",
        kind: "enum",
        filePath,
        description: extractJsDocDescription(leadingNode ?? decl),
        members,
      });
    }
  };

  traverse(ast, {
    ExportNamedDeclaration(p: any) {
      processDecl(p.node.declaration, p.node);
    },
    ExportDefaultDeclaration(p: any) {
      processDecl(p.node.declaration, p.node);
    },
    // Top-level (non-exported) declarations
    TSInterfaceDeclaration(p: any) {
      if (p.parent?.type === "ExportNamedDeclaration") return;
      if (p.parent?.type === "Program") processDecl(p.node, p.node);
    },
    TSTypeAliasDeclaration(p: any) {
      if (p.parent?.type === "ExportNamedDeclaration") return;
      if (p.parent?.type === "Program") processDecl(p.node, p.node);
    },
    TSEnumDeclaration(p: any) {
      if (p.parent?.type === "ExportNamedDeclaration") return;
      if (p.parent?.type === "Program") processDecl(p.node, p.node);
    },
  });

  return results;
}
