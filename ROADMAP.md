# 🚀 研发路线图 (Roadmap & Backlog)

本文档记录了 `local-component-mcp` 的研发历程以及未来的扩展规划。基于目前成熟的"AST 解析 + 内存索引 + 别名处理"底层架构，我们将逐步把工具的感知能力从"组件级"提升至"全工程架构级"，为 AI 打造最高效的本地代码上下文降噪引擎。

---

## ✅ 已完成 (Completed)

### 1. ⚛️ 全面支持 React 与 Vue 组件解析
- **React 组件底层支持 (v1.2.0)**：
  - 引入了基于 `react-docgen` 的解析流，原生支持 TypeScript 的 `interface` 和 `type` 定义的公开 Props 提取。
  - 支持识别经 `forwardRef`、`memo` 等高阶组件 (HOC) 包装后的组件公开属性。
  - 包含对 React 特有的 `children`、`ref` 等 Props 的完整签名提取。
- **Props 默认值提取**：
  - 支持解析 Options API 默认值、Vue 3 编译器宏 `withDefaults`，以及 React 的 `defaultProps` 和函数参数解构赋值默认值（如 `({ initialCount = 0 }) => ...`）。
- **Emits / 事件定义提取**：
  - 自动从 Vue 组件的 `defineEmits` 和 options 中的 `emits` 声明中提取所有事件（Events）名及其 JSDoc 注释。
- **Slot 插槽定义提取**：
  - 自动分析组件模板内的 `<slot>` 标签及 options 配置，提取插槽名称与相关功能描述。
- **JSDoc / 注释与用法示例提取**：
  - 精准捕获组件顶部描述、Props 字段和事件描述上的 JSDoc 注释块，完整保留 `@description`、`@example` 等最有价值的 AI 编写上下文。

### 2. 🗃️ 跨生态状态管理解析 (v1.2.0)
- **支持框架**：
  - **Vue 阵营**：Pinia Setup Store、Pinia Option Store、Vuex。
  - **React 阵营**：Zustand (`create`)、Redux Toolkit (`createSlice`，支持局部作用域变量引用解析)、Jotai (`atom` 的 state / getter / action 归类)。
- **扫描扩展**：将全局 store 文件的扫描范围扩展至 `.tsx` 与 `.jsx` 文件。

### 3. 🗂️ 路径别名解析与缓存机制 (v1.1.0)
- **智能读取**：自动解析项目 `tsconfig.json`（支持 `paths` 配置下的各种自定义别名如 `~components/*`、`#utils/*`）、`vite.config.ts` 以及 `vue.config.js` 的 alias 定义。
- **mtime 缓存系统**：基于文件修改时间（`mtime`）进行增量刷新，若配置文件被更改会自动在后台重载，无需重启 MCP 服务，避免依赖解析图谱断链。

### 4. 🔍 组件逆向引用查找 (v1.1.0)
- **功能工具**：`get_component_usages` 可以在全项目范围内定位某组件被哪些文件引用。
- **捕获类型**：脚本顶部 import 导入语句、模板/JSX 标签（支持 PascalCase 和 kebab-case，支持跟踪重命名局部导入）和脚本变量引用。

### 5. ⚡ Watch 模式与文件内存增量索引 (v1.3.0)
- **引入后台文件监听器**：基于 Node.js 原生 `fs.watch`，零新增依赖。
- **工作机制**：首次调用时全量扫描并启动递归 watcher；后续文件变更时仅对单文件执行增量重索引（150ms 防抖）。
- **性能提升**：后续工具调用直接从内存 Map 读取，I/O 开销接近零，响应由"扫全盘"降至毫秒级。
- **降级兼容**：在 `fs.watch recursive` 不可用的 Linux 环境中，自动静默回退为按需全量扫描。
- **优雅退出**：进程收到 `SIGINT` / `SIGTERM` 时自动关闭所有 watcher。

---

## 🟡 中期规划 (Medium Priority)

### 1. 🔀 Monorepo 与隐式别名完整性支持 (Monorepo & Implicit Aliases)
- **目标**：保证在复杂前端项目架构下的依赖图谱解析不发生断链。
- **具体实现**：
  - 新增对 monorepo 跨包引用（如 `workspace:*` 声明依赖）的显式文件跳转和追溯。
  - 支持 Nuxt / UnoCSS 等框架运行时的动态隐式别名自动匹配与模拟映射（按需支持，框架约定规则变化较快）。

### 2. 📖 Storybook / 组件示例文档关联 (Storybook & Usage Examples Association)
- **目标**：为 AI 提供真实世界中的组件调用代码示例。
- **具体实现**：扫描并解析项目中的 `.stories.tsx` 文件或 Markdown 组件开发文档，提取出真正的组件用法示例代码片段，并将该用例与对应的组件详情合并输出给 AI。
