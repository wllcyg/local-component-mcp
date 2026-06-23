import * as fs from "fs";
import * as path from "path";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { resolveAliasPath, isLikelyAliasPath, findProjectRoot } from "../alias.js";
import { analyzePageTree } from "../utils/page.js";

function aliasErrHint(original: string): string {
  return isLikelyAliasPath(original)
    ? `（若使用了路径别名，请检查别名配置：tsconfig.json / vite.config.ts / vue.config.js）`
    : "";
}

/**
 * analyze_page handler
 * 输入一个页面文件路径，递归分析其所有组件依赖，返回组件树
 */
export async function handleAnalyzePage(args: any) {
  let filePath = String(args?.filePath || "");
  const workspacePath = args?.workspacePath ? String(args.workspacePath) : null;
  const maxDepth = Math.min(Number(args?.maxDepth ?? 5), 10); // 最大限制 10 层
  const original = filePath;

  const resolveBase = workspacePath
    ? workspacePath
    : (findProjectRoot(process.cwd()) ?? process.cwd());

  filePath = resolveAliasPath(filePath, resolveBase);

  if (!fs.existsSync(filePath)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `页面文件不存在：${filePath}。${aliasErrHint(original)}`
    );
  }

  const ext = path.extname(filePath);
  if (![".vue", ".tsx", ".jsx"].includes(ext)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `仅支持 .vue、.tsx 和 .jsx 文件，收到：${filePath}`
    );
  }

  const projectRoot = workspacePath
    ? resolveAliasPath(workspacePath, process.cwd())
    : (findProjectRoot(filePath) ?? path.dirname(filePath));

  const tree = analyzePageTree(filePath, projectRoot, maxDepth);

  // 统计总组件数（去重）
  const allComponents = new Set<string>();
  const count = (node: typeof tree) => {
    allComponents.add(node.filePath);
    node.children.forEach(count);
  };
  count(tree);
  // 减去根节点自身（页面文件）
  allComponents.delete(filePath);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            pageFile: filePath,
            projectRoot,
            totalComponents: allComponents.size,
            tree,
          },
          null,
          2
        ),
      },
    ],
  };
}
