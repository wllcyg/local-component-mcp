# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-06-23

### Added
- **Composables / Hooks 分析** (`search_composables`, `get_composable_detail`)：
  - 扫描 `composables/`、`hooks/` 等目录下所有 `useXxx` 风格函数文件。
  - AST 提取完整函数签名：参数名、TypeScript 类型、是否可选、默认值。
  - 提取返回值对象字段列表（基于返回类型注解或函数体最后一个 `return {}` 语句）。
  - 提取 JSDoc 注释描述。
- **页面组件树分析** (`analyze_page`)：
  - 输入任意页面文件，递归解析其所有组件导入依赖，构建完整的组件依赖树。
  - 内置循环引用检测（每条路径独立 visited 集合），防止无限递归。
  - 支持 `maxDepth` 参数控制递归深度（默认 5，最大 10）。
  - 输出去重后的总组件数量统计。
- **Auto-import 感知**（增强 `get_component_usages`）：
  - 自动读取 `vite.config.ts` 中 `unplugin-vue-components` 的 `dirs` 配置。
  - 将自动注册目录下的组件纳入模板标签扫描范围，识别无显式 `import` 的模板引用。
  - 结果中对 auto-import 命中的引用标注 `autoImported: true` 字段。
- **独立类型文件索引** (`search_types`, `get_type_detail`)：
  - 扫描 `types/`、`interfaces/`、`models/` 等目录下的所有 `.ts` 文件。
  - AST 提取 `interface`、`type alias`（含对象字面量成员）、`enum` 三类定义。
  - 每个成员提取：字段名、TS 类型字符串、是否可选、JSDoc 行内注释。
  - 支持按类型名精确查询（`typeName` 参数）。

---

## [1.3.0] - 2026-06-23

### Added
- **Watch 模式 & 增量索引**：引入后台文件监听器（基于 Node.js 原生 `fs.watch`，零新增依赖）。
  - 首次调用 `get_component_usages` 时对项目目录执行一次全量扫描，随后启动递归 watcher。
  - 文件新增、变更或删除时，仅对该文件执行增量重索引（150ms 防抖），无需重启 MCP 服务。
  - 后续所有工具调用直接从内存索引中读取结果，I/O 开销接近零。
  - 在 Linux 环境 `fs.watch recursive` 不可用时，自动静默降级为按需全量扫描（旧行为）。
  - 进程收到 `SIGINT` / `SIGTERM` 时自动关闭所有 watcher，优雅退出。

---

## [1.2.2] - 2026-06-23

### Added
- Added automated unit test suite using `vitest`.
- Configured GitHub action workflows for validation.

### Changed
- Upgraded `@modelcontextprotocol/sdk` from `^0.6.0` to `^1.0.1` (compiled and tested compatibility with `1.29.0`).
- Improved `package.json` metadata by enriching description and adding package keywords to improve NPM discoverability.

### Removed
- Removed unused dependency `tiktoken` to reduce installation size and build complexity.

---

## [1.2.0] - 2026-06-22

### Added
- **React Components Support**: Integrated `react-docgen` to support AST parsing for React files (`.tsx`, `.jsx`).
- **React State Management Support**: Added parsing logic in `get_store_detail` for:
  - **Zustand** (`create(...)` / `create()(...)`)
  - **Redux Toolkit** (`createSlice(...)` with local scope variable lookups)
  - **Jotai** (`atom(...)`)
- Added support for scanning `.tsx` and `.jsx` extensions in `search_stores` tool.

---

## [1.1.2] - 2026-06-22

### Fixed
- Fixed bug where file resolver failed on empty configuration files.
- Unified error prompts to Chinese for better localized AI developer experience.

---

## [1.1.0] - 2026-06-22

### Added
- **Usages Lookup**: Added new tool `get_component_usages` to find all occurrences of a component in the workspace (import statements, template/JSX tags, and script variable calls).
- **Alias Resolution**: Automatically resolve project-defined path aliases (e.g. `@/*`) by reading `tsconfig.json`, `vite.config.ts`, and `vue.config.js`.
- **mtime Caching**: Implemented incremental alias configuration loading based on file change times (`mtime`) to avoid performance lags without server restarts.

---

## [1.0.0] - 2026-06-21

### Added
- Initial release of `local-component-mcp` server.
- Supported Vue components parsing (`vue-docgen-api`) for Props, Events, Slots.
- Supported Vuex / Pinia (Option & Setup styles) store parsing.
