import * as fs from "fs";
import * as path from "path";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { resolveAliasPath, isLikelyAliasPath, findProjectRoot } from "../alias.js";
import { scanComposableFiles, parseComposableFile } from "../utils/composables.js";

function aliasErrHint(original: string): string {
  return isLikelyAliasPath(original)
    ? `（若使用了路径别名，请检查别名配置：tsconfig.json / vite.config.ts / vue.config.js）`
    : "";
}

/**
 * search_composables handler
 * 在工作区中搜索所有 useXxx composable/hook 文件
 */
export async function handleSearchComposables(args: any) {
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

  const files = scanComposableFiles(workspacePath);

  // 按关键词过滤文件路径
  const filteredFiles = keyword
    ? files.filter((f) =>
        path.relative(workspacePath, f).replace(/\\/g, "/").toLowerCase().includes(keyword)
      )
    : files;

  // 扫描每个文件，提取 composable 名称列表（轻量预览）
  const composables = filteredFiles.flatMap((filePath) => {
    const infos = parseComposableFile(filePath);
    return infos.map((info) => ({
      name: info.name,
      filePath: info.filePath,
      relativeFilePath: path.relative(workspacePath, info.filePath),
      paramCount: info.params.length,
      returnCount: info.returns.length,
      hasDescription: !!info.description,
    }));
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ count: composables.length, composables }, null, 2),
      },
    ],
  };
}

/**
 * get_composable_detail handler
 * 解析单个 composable 文件，返回完整签名信息
 */
export async function handleGetComposableDetail(args: any) {
  let filePath = String(args?.filePath || "");
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

  const infos = parseComposableFile(filePath);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ filePath, composables: infos }, null, 2),
      },
    ],
  };
}
