import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { extractScriptBlock } from "./files.js";

const traverse = _traverse.default || _traverse;

export interface ParamInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ComposableReturn {
  name: string;
  type: string;
}

export interface ComposableInfo {
  name: string;
  filePath: string;
  description: string;
  params: ParamInfo[];
  returns: ComposableReturn[];
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

/** 判断是否是 composable/hook 文件目录 */
function isComposableDir(dirName: string): boolean {
  return /composables?|hooks?/i.test(dirName);
}

/** 递归扫描并收集 composable 文件 */
function collectComposableFiles(
  dir: string,
  fileList: string[] = [],
  isInsideComposableDir = false
): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return fileList;
  }

  for (const file of entries) {
    const filePath = path.join(dir, file);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(file)) continue;
      const inComposable = isInsideComposableDir || isComposableDir(file);
      collectComposableFiles(filePath, fileList, inComposable);
    } else if (isInsideComposableDir) {
      // 在 composables/ 目录下：收集所有 .ts/.tsx/.js 文件
      if (/\.(m?[tj]sx?)$/.test(file) && !file.endsWith(".d.ts")) {
        fileList.push(filePath);
      }
    } else {
      // 在普通目录下：只收集文件名以 use 开头的文件
      if (/^use[A-Z].*\.(m?[tj]sx?)$/.test(file) && !file.endsWith(".d.ts")) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

/** 从 JSDoc 注释块提取描述文本 */
function extractJsDocDescription(node: any): string {
  if (!node.leadingComments) return "";
  for (const comment of node.leadingComments) {
    if (comment.type === "CommentBlock") {
      const lines = comment.value.split("\n").map((l: string) =>
        l.replace(/^\s*\*\s?/, "").trim()
      );
      return lines.filter((l: string) => l && !l.startsWith("@")).join(" ").trim();
    }
  }
  return "";
}

/** 将 AST TypeAnnotation 节点转换为可读类型字符串 */
function typeAnnotationToString(typeAnnotation: any): string {
  if (!typeAnnotation) return "any";
  const ta = typeAnnotation.typeAnnotation ?? typeAnnotation;
  if (!ta) return "any";

  switch (ta.type) {
    case "TSStringKeyword": return "string";
    case "TSNumberKeyword": return "number";
    case "TSBooleanKeyword": return "boolean";
    case "TSAnyKeyword": return "any";
    case "TSVoidKeyword": return "void";
    case "TSNeverKeyword": return "never";
    case "TSUnknownKeyword": return "unknown";
    case "TSUndefinedKeyword": return "undefined";
    case "TSNullKeyword": return "null";
    case "TSArrayType":
      return `${typeAnnotationToString(ta.elementType)}[]`;
    case "TSTypeReference":
      if (ta.typeName?.type === "Identifier") return ta.typeName.name;
      if (ta.typeName?.type === "TSQualifiedName")
        return `${ta.typeName.left?.name}.${ta.typeName.right?.name}`;
      return "object";
    case "TSUnionType":
      return (ta.types || []).map(typeAnnotationToString).join(" | ");
    case "TSIntersectionType":
      return (ta.types || []).map(typeAnnotationToString).join(" & ");
    case "TSObjectKeyword": return "object";
    case "TSParenthesizedType":
      return `(${typeAnnotationToString(ta.typeAnnotation)})`;
    case "TSFunctionType": {
      const params = (ta.params || [])
        .map((p: any) => `${p.name || "_"}: ${typeAnnotationToString(p.typeAnnotation)}`)
        .join(", ");
      const ret = typeAnnotationToString(ta.typeAnnotation);
      return `(${params}) => ${ret}`;
    }
    case "TSTypeLiteral": return "object";
    case "TSPromiseType":
    case "TSTypeQuery": return "Promise<unknown>";
    default: return "any";
  }
}

/** 提取函数参数列表 */
function extractParams(params: any[]): ParamInfo[] {
  return params.map((param: any) => {
    if (param.type === "AssignmentPattern") {
      // 有默认值的参数：param = defaultValue
      const inner = param.left;
      let defaultValue = "";
      try {
        if (param.right?.type === "StringLiteral") defaultValue = `"${param.right.value}"`;
        else if (param.right?.type === "NumericLiteral") defaultValue = String(param.right.value);
        else if (param.right?.type === "BooleanLiteral") defaultValue = String(param.right.value);
        else if (param.right?.type === "NullLiteral") defaultValue = "null";
        else defaultValue = "...";
      } catch { defaultValue = "..."; }

      return {
        name: inner?.name || "_",
        type: typeAnnotationToString(inner?.typeAnnotation),
        optional: true,
        defaultValue,
      };
    }

    if (param.type === "ObjectPattern" || param.type === "ArrayPattern") {
      return {
        name: param.type === "ObjectPattern" ? "{ ... }" : "[ ... ]",
        type: typeAnnotationToString(param.typeAnnotation),
        optional: !!param.optional,
      };
    }

    return {
      name: param.name || "_",
      type: typeAnnotationToString(param.typeAnnotation),
      optional: !!param.optional,
    };
  });
}

/** 从函数返回类型 or 函数体末尾 return 语句推断返回值列表 */
function extractReturns(node: any): ComposableReturn[] {
  // 优先使用显式返回类型注解
  if (node.returnType) {
    const ta = node.returnType.typeAnnotation ?? node.returnType;
    if (ta?.type === "TSTypeLiteral") {
      return (ta.members || [])
        .filter((m: any) => m.type === "TSPropertySignature")
        .map((m: any) => ({
          name: m.key?.name || m.key?.value || "?",
          type: typeAnnotationToString(m.typeAnnotation),
        }));
    }
    return [{ name: "(return)", type: typeAnnotationToString(node.returnType) }];
  }

  // 无类型注解：尝试找最后一个 return 对象字面量的 key 列表
  const body = node.body;
  if (!body || body.type !== "BlockStatement") return [];

  for (let i = body.body.length - 1; i >= 0; i--) {
    const stmt = body.body[i];
    if (stmt.type === "ReturnStatement" && stmt.argument?.type === "ObjectExpression") {
      return stmt.argument.properties
        .filter((p: any) => p.type === "ObjectProperty" || p.type === "ObjectMethod")
        .map((p: any) => ({
          name: p.key?.name || p.key?.value || "?",
          type: "unknown",
        }));
    }
  }

  return [];
}

/** 解析单个文件，提取其中所有 useXxx 函数 */
export function parseComposableFile(filePath: string): ComposableInfo[] {
  const results: ComposableInfo[] = [];

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
      attachComment: true,
    });
  } catch {
    return results;
  }

  const isUseFn = (name: string) => /^use[A-Z]/.test(name);

  traverse(ast, {
    // export function useXxx(...) {}
    ExportNamedDeclaration(nodePath: any) {
      const decl = nodePath.node.declaration;
      if (!decl) return;

      if (decl.type === "FunctionDeclaration" && isUseFn(decl.id?.name || "")) {
        results.push({
          name: decl.id.name,
          filePath,
          description: extractJsDocDescription(nodePath.node),
          params: extractParams(decl.params || []),
          returns: extractReturns(decl),
        });
      }

      if (decl.type === "VariableDeclaration") {
        for (const declarator of decl.declarations) {
          if (!isUseFn(declarator.id?.name || "")) continue;
          const init = declarator.init;
          if (
            init?.type === "ArrowFunctionExpression" ||
            init?.type === "FunctionExpression"
          ) {
            results.push({
              name: declarator.id.name,
              filePath,
              description: extractJsDocDescription(nodePath.node),
              params: extractParams(init.params || []),
              returns: extractReturns(init),
            });
          }
        }
      }
    },

    // function useXxx() {} (non-exported, top-level)
    FunctionDeclaration(nodePath: any) {
      if (nodePath.parent?.type !== "Program" && nodePath.parent?.type !== "ExportNamedDeclaration") return;
      if (nodePath.parent?.type === "ExportNamedDeclaration") return; // handled above
      const name = nodePath.node.id?.name || "";
      if (!isUseFn(name)) return;
      results.push({
        name,
        filePath,
        description: extractJsDocDescription(nodePath.node),
        params: extractParams(nodePath.node.params || []),
        returns: extractReturns(nodePath.node),
      });
    },

    // const useXxx = () => {} (non-exported)
    VariableDeclaration(nodePath: any) {
      if (nodePath.parent?.type !== "Program") return;
      for (const declarator of nodePath.node.declarations) {
        if (!isUseFn(declarator.id?.name || "")) continue;
        const init = declarator.init;
        if (
          init?.type === "ArrowFunctionExpression" ||
          init?.type === "FunctionExpression"
        ) {
          results.push({
            name: declarator.id.name,
            filePath,
            description: extractJsDocDescription(nodePath.node),
            params: extractParams(init.params || []),
            returns: extractReturns(init),
          });
        }
      }
    },
  });

  return results;
}

/** 在 projectRoot 下搜索所有 composable 文件 */
export function scanComposableFiles(projectRoot: string): string[] {
  return collectComposableFiles(projectRoot);
}
