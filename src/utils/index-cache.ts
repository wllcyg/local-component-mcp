import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import { resolveAliasPath } from "../alias.js";
import { scanCodeFiles, extractScriptBlock } from "./files.js";

const traverse = _traverse.default || _traverse;

interface FileIndexEntry {
  /** 文件上次被索引时的 mtime */
  mtime: number;
  /** 该文件所有导入的路径（绝对路径，无扩展名）*/
  importedPaths: Set<string>;
}

interface WatchState {
  index: Map<string, FileIndexEntry>;
  watcher: fs.FSWatcher | null;
  /** 防抖 timer，key = 文件路径 */
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
}

// ─────────────────────────────────────────────
// 单例：所有已监听的项目根 → WatchState
// ─────────────────────────────────────────────
const watchedRoots = new Map<string, WatchState>();

// ─────────────────────────────────────────────
// 底层：对单个文件执行增量索引
// ─────────────────────────────────────────────
function indexFile(
  file: string,
  fileDir: string,
  index: Map<string, FileIndexEntry>
): void {
  const mtime = (() => {
    try { return fs.statSync(file).mtimeMs; } catch { return 0; }
  })();

  const cached = index.get(file);
  if (cached && cached.mtime === mtime) return; // 未变化，跳过

  const importedPaths = new Set<string>();
  try {
    const code = fs.readFileSync(file, "utf-8");
    const scriptCode = file.endsWith(".vue") ? extractScriptBlock(code) : code;
    if (scriptCode.trim()) {
      const ast = babelParser.parse(scriptCode, {
        sourceType: "module",
        plugins: ["typescript", "jsx", "decorators-legacy"],
      });
      traverse(ast, {
        ImportDeclaration(p: any) {
          const resolved = resolveAliasPath(p.node.source.value, fileDir);
          importedPaths.add(resolved.replace(/\.[^/.]+$/, ""));
        },
        CallExpression(p: any) {
          if (p.node.callee.type === "Import") {
            const arg = p.node.arguments[0];
            if (arg?.type === "StringLiteral") {
              const resolved = resolveAliasPath(arg.value, fileDir);
              importedPaths.add(resolved.replace(/\.[^/.]+$/, ""));
            }
          }
        },
      });
    }
  } catch {
    // 解析失败，importedPaths 保持空集合
  }
  index.set(file, { mtime, importedPaths });
}

// ─────────────────────────────────────────────
// 全量扫描并初始化 index
// ─────────────────────────────────────────────
function fullScan(projectRoot: string, index: Map<string, FileIndexEntry>): void {
  const files = scanCodeFiles(projectRoot);
  const fileSet = new Set(files);

  // 清理已删除文件的条目
  for (const key of index.keys()) {
    if (!fileSet.has(key)) index.delete(key);
  }

  // 新增 / 增量更新
  for (const file of files) {
    indexFile(file, path.dirname(file), index);
  }
}

// ─────────────────────────────────────────────
// 处理 watcher 事件（含 150ms 防抖）
// ─────────────────────────────────────────────
function handleWatchEvent(
  projectRoot: string,
  state: WatchState,
  eventType: string,
  filename: string | null
): void {
  if (!filename) return;

  // fs.watch 返回的 filename 是相对于监听目录的相对路径
  const absPath = path.resolve(projectRoot, filename);

  // 只处理代码文件
  if (!/\.(vue|[mc]?[tj]sx?)$/.test(absPath)) return;

  // 清除旧的防抖 timer
  const existing = state.debounceTimers.get(absPath);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    state.debounceTimers.delete(absPath);

    if (!fs.existsSync(absPath)) {
      // 文件已删除 → 从 index 移除
      if (state.index.has(absPath)) {
        state.index.delete(absPath);
        console.error(`[watch] removed: ${absPath}`);
      }
    } else {
      // 文件新增或变更 → 增量重新索引
      const prevMtime = state.index.get(absPath)?.mtime ?? -1;
      indexFile(absPath, path.dirname(absPath), state.index);
      const newMtime = state.index.get(absPath)?.mtime ?? -1;
      if (newMtime !== prevMtime) {
        console.error(`[watch] updated: ${absPath}`);
      }
    }
  }, 150);

  state.debounceTimers.set(absPath, timer);
}

// ─────────────────────────────────────────────
// 对外 API：确保 projectRoot 已被监听
// ─────────────────────────────────────────────
function ensureWatching(projectRoot: string): WatchState {
  if (watchedRoots.has(projectRoot)) {
    return watchedRoots.get(projectRoot)!;
  }

  const state: WatchState = {
    index: new Map(),
    watcher: null,
    debounceTimers: new Map(),
  };
  watchedRoots.set(projectRoot, state);

  // 首次全量扫描
  fullScan(projectRoot, state.index);

  // 启动 watcher（recursive 支持 macOS / Windows；Linux 需逐级监听，此处统一尝试）
  try {
    state.watcher = fs.watch(
      projectRoot,
      { recursive: true },
      (eventType, filename) => {
        handleWatchEvent(projectRoot, state, eventType, filename);
      }
    );

    // watcher 出错时静默降级（不影响功能，只是变回按需扫描）
    state.watcher.on("error", (err) => {
      console.error(`[watch] watcher error for ${projectRoot}:`, err.message);
      state.watcher?.close();
      state.watcher = null;
    });

    console.error(`[watch] watching: ${projectRoot}`);
  } catch (err: any) {
    // fs.watch recursive 在某些 Linux 环境不支持，静默降级
    console.error(`[watch] fs.watch unavailable for ${projectRoot}, falling back to on-demand scan: ${err.message}`);
    state.watcher = null;
  }

  return state;
}

// ─────────────────────────────────────────────
// 停止所有 watcher（测试 / 优雅退出用）
// ─────────────────────────────────────────────
export function stopAllWatchers(): void {
  for (const [root, state] of watchedRoots) {
    // 清理所有防抖 timer
    for (const t of state.debounceTimers.values()) clearTimeout(t);
    state.debounceTimers.clear();
    state.watcher?.close();
    console.error(`[watch] stopped: ${root}`);
  }
  watchedRoots.clear();
}

// ─────────────────────────────────────────────
// buildIndex：供 queryImporters 调用，接口不变
// ─────────────────────────────────────────────
export function buildIndex(projectRoot: string): Map<string, FileIndexEntry> {
  const state = ensureWatching(projectRoot);

  // 若 watcher 不可用（Linux 降级），则每次调用时做增量扫描（与旧行为一致）
  if (!state.watcher) {
    fullScan(projectRoot, state.index);
  }

  return state.index;
}

// ─────────────────────────────────────────────
// queryImporters：接口不变
// ─────────────────────────────────────────────
export function queryImporters(
  projectRoot: string,
  targetNoExt: string
): string[] {
  const index = buildIndex(projectRoot);
  const result: string[] = [];
  for (const [file, entry] of index) {
    if (entry.importedPaths.has(targetNoExt)) {
      result.push(file);
    }
  }
  return result;
}
