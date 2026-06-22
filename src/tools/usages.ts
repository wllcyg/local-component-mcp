import * as fs from "fs";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { resolveAliasPath, isLikelyAliasPath, findProjectRoot } from "../alias.js";
import { findComponentUsages } from "../utils/usages.js";

function aliasErrHint(original: string): string {
  return isLikelyAliasPath(original)
    ? `（若使用了路径别名，请检查别名配置：tsconfig.json / vite.config.ts / vue.config.js）`
    : "";
}

/**
 * get_component_usages handler
 */
export async function handleGetComponentUsages(args: any) {
  let componentPath = String(args?.componentPath || "");
  let workspacePath = String(args?.workspacePath || "");
  const originalPath = componentPath;

  componentPath = resolveAliasPath(componentPath, process.cwd());

  if (!fs.existsSync(componentPath)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `组件路径不存在：${componentPath}。${aliasErrHint(originalPath)}`
    );
  }

  const projectRoot = workspacePath
    ? resolveAliasPath(workspacePath, process.cwd())
    : (findProjectRoot(componentPath) ?? process.cwd());

  if (!fs.existsSync(projectRoot)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `工作区路径不存在：${projectRoot}`
    );
  }

  const usages = findComponentUsages(componentPath, projectRoot);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ componentPath, workspacePath: projectRoot, usages }, null, 2),
      },
    ],
  };
}
