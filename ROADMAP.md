# 🚀 研发路线图 (Roadmap & Backlog)

本文档记录了 `local-component-mcp` 的研发历程以及未来的扩展规划。基于目前成熟的"AST 解析 + 内存索引 + 别名处理"底层架构，我们将逐步把工具的感知能力从"组件级"提升至"全工程架构级"，为 AI 打造最高效的本地代码上下文降噪引擎。

---

## ✅ 已完成 (Completed)

### 1. ⚛️ 全面支持 React 与 Vue 组件解析 (v1.2.0)
- **React 组件底层支持**：引入了基于 `react-docgen` 的解析流，原生支持 TypeScript 的 `interface` 和 `type` 定义的公开 Props 提取，支持 `forwardRef`、`memo` 等 HOC 包装组件。
- **Props 默认值提取**：支持 Options API 默认值、Vue 3 编译器宏 `withDefaults`，以及 React 的 `defaultProps` 和函数参数解构赋值默认值。
- **Emits / 事件定义提取**：从 `defineEmits` 和 options 的 `emits` 声明中提取事件名及 JSDoc 注释。
- **Slot 插槽定义提取**：分析模板内的 `<slot>` 标签及 options 配置，提取插槽名称与描述。
- **JSDoc / 注释与用法示例提取**：精准捕获 `@description`、`@example` 等最有价值的 AI 上下文。

### 2. 🗃️ 跨生态状态管理解析 (v1.2.0)
- **Vue 阵营**：Pinia Setup Store、Pinia Option Store、Vuex。
- **React 阵营**：Zustand (`create`)、Redux Toolkit (`createSlice`，含局部变量引用解析)、Jotai (`atom` 的 state / getter / action 归类)。
- 扫描范围扩展至 `.tsx` 与 `.jsx` 文件。

### 3. 🗂️ 路径别名解析与缓存机制 (v1.1.0)
- 自动解析 `tsconfig.json`、`vite.config.ts`、`vue.config.js` 的 alias 配置（支持 `~components/*`、`#utils/*` 等）。
- 基于 `mtime` 的增量刷新：配置文件修改后自动重载，无需重启 MCP 服务。

### 4. 🔍 组件逆向引用查找 (v1.1.0)
- `get_component_usages`：全项目定位某组件的所有引用位置。
- 捕获类型：import 语句、模板/JSX 标签（PascalCase 和 kebab-case，支持重命名导入）、脚本变量引用。

### 5. ⚡ Watch 模式与文件内存增量索引 (v1.3.0)
- 基于 Node.js 原生 `fs.watch`，零新增依赖。首次调用全量扫描 + 启动 watcher；后续文件变更仅对单文件增量重索引（150ms 防抖）。
- 后续工具调用直接从内存 Map 读取，I/O 开销接近零。
- Linux 下 `fs.watch recursive` 不可用时，自动静默回退为按需全量扫描。

### 6. 🪝 Composables / Hooks 分析 (v1.4.0)
- `search_composables`：扫描 `composables/`、`hooks/` 目录下所有 `useXxx` 风格函数文件。
- `get_composable_detail`：AST 提取完整函数签名——参数名、TypeScript 类型、是否可选、默认值，以及返回值字段列表和 JSDoc 描述。
- 同时支持 `export function useXxx`、`export const useXxx = () => {}` 两种写法。

### 7. 🌳 页面组件树分析 (v1.4.0)
- `analyze_page`：输入任意页面文件，递归解析其所有组件导入依赖，构建完整的组件依赖树。
- 内置循环引用检测（每条路径独立 visited 集合）。
- 支持 `maxDepth` 参数控制递归深度（默认 5，最大 10），并输出去重后的总组件数量。

### 8. 🤖 Auto-import 感知 (v1.4.0)
- 增强 `get_component_usages`：自动读取 `vite.config.ts` 中 `unplugin-vue-components` 的 `dirs` 配置。
- 识别无显式 `import` 的模板引用，并在结果中标注 `autoImported: true`。
- 配置读取结果按 mtime 缓存，vite.config 修改后自动失效。

### 9. 📐 独立类型文件索引 (v1.4.0)
- `search_types`：扫描 `types/`、`interfaces/`、`models/` 等目录下所有 TypeScript 类型定义文件。
- `get_type_detail`：AST 提取 `interface`、`type alias`（含对象字面量成员）、`enum` 三类定义，每个成员提取字段名、TS 类型字符串、是否可选、JSDoc 注释。
- 支持 `typeName` 参数按名精确查询。

---

## 🟡 中期规划 (Medium Priority)

### 1. 🔀 Monorepo 与隐式别名完整性支持
- **目标**：保证复杂前端项目架构下的依赖图谱解析不发生断链。
- 新增对 monorepo 跨包引用（`workspace:*`）的显式文件跳转和追溯。
- Nuxt / UnoCSS 等框架的运行时隐式别名按需支持（框架约定规则变化较快，优先级次之）。

### 2. 📖 JSDoc @example / 测试用例关联
- **目标**：为 AI 提供真实世界的组件调用代码示例。
- 扫描组件及对应测试文件中的 `@example` JSDoc 块或组件调用片段，合并输出至 `get_component_detail` 结果中。
- 比 Storybook 覆盖面更广（不依赖特定测试框架）。
