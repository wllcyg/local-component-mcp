import * as fs from "fs";
import * as path from "path";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { resolveAliasPath, isLikelyAliasPath, findProjectRoot } from "../alias.js";
import { scanTypeFiles, parseTypeFile } from "../utils/types.js";

function aliasErrHint(original: string): string {
  return isLikelyAliasPath(original)
    ? `（若使用了路径别名，请检查别名配置：tsconfig.json / vite.config.ts / vue.config.js）`
    : "";
}

/**
 * search_types handler
 * 在工作区中搜索所有类型定义文件（interface / type / enum）
 */
export async function handleSearchTypes(args: any) {
  let workspacePath = String(args?.workspacePath || "");
  const keyword = String(args?.keyword || "").toLowerCase();
  const original = workspacePath;

  workspacePath = resolveAliasPath(workspacePath, process.cwd());

  if (!fs.existsSync(workspacePath)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `工作区路径不存在：${workspacePath}。${aliasErrHint(original)}`
    );
  }

  const files = scanTypeFiles(workspacePath);

  // 扫描每个文件，提取类型名称列表（轻量预览）
  const allTypes = files.flatMap((filePath) => {
    const defs = parseTypeFile(filePath);
    return defs.map((def) => ({
      name: def.name,
      kind: def.kind,
      filePath: def.filePath,
      relativeFilePath: path.relative(workspacePath, def.filePath),
      memberCount: def.members.length,
      hasDescription: !!def.description,
    }));
  });

  // 按关键词过滤
  const filtered = keyword
    ? allTypes.filter(
        (t) =>
          t.name.toLowerCase().includes(keyword) ||
          t.relativeFilePath.toLowerCase().includes(keyword)
      )
    : allTypes;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ count: filtered.length, types: filtered }, null, 2),
      },
    ],
  };
}

/**
 * get_type_detail handler
 * 解析单个类型文件，返回其中所有 interface/type/enum 的完整定义
 */
export async function handleGetTypeDetail(args: any) {
  let filePath = String(args?.filePath || "");
  const typeName = args?.typeName ? String(args.typeName) : null;
  const workspacePath = args?.workspacePath ? String(args.workspacePath) : null;
  const original = filePath;

  const resolveBase = workspacePath
    ? workspacePath
    : (findProjectRoot(process.cwd()) ?? process.cwd());

  filePath = resolveAliasPath(filePath, resolveBase);

  if (!fs.existsSync(filePath)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `文件不存在：${filePath}。${aliasErrHint(original)}`
    );
  }

  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `仅支持 .ts 和 .tsx 文件，收到：${filePath}`
    );
  }

  let defs = parseTypeFile(filePath);

  // 如果指定了类型名，只返回该类型
  if (typeName) {
    defs = defs.filter((d) => d.name === typeName);
    if (defs.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `在文件 ${filePath} 中未找到类型定义：${typeName}`
      );
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ filePath, definitions: defs }, null, 2),
      },
    ],
  };
}
