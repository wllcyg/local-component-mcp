import * as fs from "fs";
import * as path from "path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

/**
 * 递归获取目录下所有的组件文件（.vue, .tsx, .jsx），跳过 node_modules 等文件夹
 */
export function getComponentFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (SKIP_DIRS.has(path.basename(filePath))) continue;
      getComponentFiles(filePath, fileList);
    } else {
      const ext = path.extname(filePath);
      if (ext === ".vue" || ext === ".tsx" || ext === ".jsx") {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

/**
 * 递归扫描目录，收集所有代码文件（.vue/.tsx/.jsx/.ts/.js/.mts/.cts）
 */
export function scanCodeFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (SKIP_DIRS.has(path.basename(filePath))) continue;
      scanCodeFiles(filePath, fileList);
    } else {
      if (/\.(vue|[mc]?[tj]sx?)$/.test(filePath)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

/**
 * 从 .vue 文件中提取所有 <script> 块内容（合并，支持同时存在 <script> 和 <script setup>）
 */
export function extractScriptBlock(content: string): string {
  const blocks: string[] = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    blocks.push(match[1]);
  }
  return blocks.join("\n");
}
