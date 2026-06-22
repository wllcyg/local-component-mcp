import * as fs from "fs";
import * as path from "path";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { parse as parseReact } from "react-docgen";
import { parse as parseVue } from "vue-docgen-api";
import { resolveAliasPath, isLikelyAliasPath, findProjectRoot } from "../alias.js";
import { getComponentFiles } from "../utils/files.js";
import { extractImports } from "../utils/imports.js";

function aliasErrHint(original: string): string {
  return isLikelyAliasPath(original)
    ? `（若使用了路径别名，请检查别名配置：tsconfig.json / vite.config.ts / vue.config.js）`
    : "";
}

/**
 * search_components handler
 */
export async function handleSearchComponents(args: any) {
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

  let files = getComponentFiles(workspacePath);
  if (keyword) {
    files = files.filter((f) => path.basename(f).toLowerCase().includes(keyword));
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ count: files.length, files }, null, 2),
      },
    ],
  };
}

/**
 * get_component_detail handler
 * 新增可选 workspacePath：用于在别名解析时指定项目根目录
 */
export async function handleGetComponentDetail(args: any) {
  let filePath = String(args?.filePath || "");
  const workspacePath = args?.workspacePath ? String(args.workspacePath) : null;
  const original = filePath;

  // 确定别名解析的起始目录：优先使用传入的 workspacePath，否则向上查找
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

  const ext = path.extname(filePath);
  if (ext !== ".vue" && ext !== ".tsx" && ext !== ".jsx") {
    throw new McpError(
      ErrorCode.InvalidParams,
      `仅支持 .vue、.tsx 和 .jsx 文件，收到：${filePath}`
    );
  }

  let componentDoc: any = {};
  try {
    if (ext === ".vue") {
      componentDoc = await parseVue(filePath);
    } else {
      const code = fs.readFileSync(filePath, "utf-8");
      const docs = parseReact(code, {
        babelOptions: {
          filename: filePath,
          babelrc: false,
          configFile: false,
        },
      });
      if (Array.isArray(docs) && docs.length > 0) {
        componentDoc = { ...docs[0], components: docs };
      } else {
        componentDoc = {};
      }
    }
  } catch (err: any) {
    componentDoc = { __failedToDocgen: true, __error: err?.message || String(err) };
  }

  const imports = extractImports(filePath);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ ...componentDoc, imports }, null, 2),
      },
    ],
  };
}
