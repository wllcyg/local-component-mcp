# local-component-mcp

<p>
  <a href="https://www.npmjs.com/package/@wllcyg001/local-component-mcp"><img src="https://img.shields.io/npm/v/@wllcyg001/local-component-mcp" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@wllcyg001/local-component-mcp"><img src="https://img.shields.io/npm/dm/@wllcyg001/local-component-mcp" alt="npm downloads" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license" />
</p>

[English](#english) | [中文](#中文)

---

## English

An MCP Server that gives AI coding assistants accurate knowledge of your **private, in-house component libraries**.

### The Problem

When you use Cursor or Claude on an enterprise codebase, the AI has never seen your internal components. It knows `el-table` from Element Plus — but it has no idea what `<ProTable>`, `<BizSelect>`, or `<OrgTreePicker>` accept as props. So it guesses. It hallucinates prop names, skips required parameters, and passes wrong event names.

The root cause: default RAG retrieves raw source files, which are full of business logic noise. The AI has to infer the public API from hundreds of lines of internals.

**This MCP solves that.** It uses AST-level static analysis to extract only the public interface — Props, Events, Slots, and comments — and serves it to the AI as clean structured JSON. The AI gets the same quality of information it would have from official documentation.

### Features

- **AST-based extraction** via `vue-docgen-api` and `react-docgen` — no raw source code sent to the model
- **Up to 80% token savings** compared to sending full component files
- **Zero hallucinations** on prop names, types, defaults, and required fields
- **Store analysis** for Pinia, Vuex, Zustand, Redux Toolkit, and Jotai
- **Composables / Hooks analysis** — extracts `useXxx` signatures, param types, return shapes, and JSDoc
- **Page component tree** — recursively resolves all component dependencies of a page file
- **Auto-import awareness** — detects `unplugin-vue-components` config, finds template usages without explicit imports
- **TypeScript type indexing** — extracts `interface`, `type alias`, and `enum` definitions from type files
- **Reverse usage lookup** — find every file that imports a given component
- **Path alias support** — reads `tsconfig.json`, `vite.config.ts`, `vue.config.js` automatically
- **In-memory Watch mode** — file watcher keeps the import index hot; queries read from memory, not disk
- **Zero maintenance** — code is the source of truth; no JSON configs or wikis to keep updated

### Installation

No local install needed. Configure directly in your AI client using `npx`.

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "local-component-mcp": {
      "command": "npx",
      "args": ["-y", "@wllcyg001/local-component-mcp"]
    }
  }
}
```

**Cursor** — Settings → Features → MCP Servers → Add New MCP Server:
- Mode: `command`
- Name: `local-component-mcp`
- Command: `npx -y @wllcyg001/local-component-mcp`

**Claude Code**:

```bash
claude mcp add local-component-mcp -- npx -y @wllcyg001/local-component-mcp
```

> **For local development:** clone the repo, run `npm install && npm run build`, then start with `node build/index.js`.

### Available Tools

| Tool | Description |
|------|-------------|
| `search_components` | Scan a directory for `.vue` / `.tsx` / `.jsx` files, with optional keyword filter |
| `get_component_detail` | AST-parse a component and return its Props, Events, Slots, comments, and imports |
| `get_component_usages` | Find every file that imports or uses a given component, with line numbers. Auto-import aware. |
| `search_stores` | Scan a workspace for Pinia / Vuex / Zustand / Redux / Jotai store files |
| `get_store_detail` | Parse a store file and return its state fields, getters, and actions |
| `search_composables` | Scan `composables/` and `hooks/` dirs for all `useXxx` functions |
| `get_composable_detail` | Parse a composable file and return full signatures: param types, defaults, return fields, JSDoc |
| `analyze_page` | Recursively resolve all component dependencies of a page file and return the full component tree |
| `search_types` | Scan `types/` / `interfaces/` dirs for `interface`, `type`, and `enum` definitions |
| `get_type_detail` | Parse a type file and return all member definitions with types, optionality, and JSDoc |
| `query_ast` | High-performance, language-aware AST pattern matching search across workspaces. Natively parses `.vue` (SFC), JSX/TSX, HTML, and JS/TS files. |

All tools support **alias paths** (e.g., `@/components/ProTable.vue`).

### Usage Examples

**Find a component:**
> "Search `/home/user/projects/my-app/src/components` for anything related to 'organization' or 'user picker'."

**Use a component correctly:**
> "Parse `@/components/ProTable.vue`, then write a User List page with name and employee ID columns. Use only the props and pagination events that ProTable actually exposes."

**Safe refactoring:**
> "I'm changing the `size` prop of `MyButton.vue` from a string to an enum. Find every file in the project that uses this component and show me what value they're passing to `size`."

**Understand a page before editing:**
> "Run `analyze_page` on `@/views/OrderDetail.vue` and show me which components it uses and how they nest."

**Reuse existing business logic:**
> "Search composables in `@/composables`, find anything related to permissions or auth, then show me the full signature of that hook."

**Type-safe code generation:**
> "Look up the `OrderDetail` type in `@/types/order.ts`, then generate a function that processes it correctly without making up any fields."

**Semantic AST Pattern Matching:**
> "Use `query_ast` to find every place where `ElMessage.success` is called with a specific variable pattern, and show me the exact arguments."

---

## 中文

一个专门为企业内部二次封装组件库设计的 MCP Server，让 AI 编码助手准确理解你的私有组件。

### 为什么需要它？

在企业项目中使用 Cursor 或 Claude 时，AI 了解 Element Plus，但它从未见过你们项目里的 `<ProTable>`、`<BizSelect>`、`<OrgTreePicker>`。它只能猜测。结果是：乱填 prop 名、漏传必填参数、写错事件名——幻觉严重。

根本原因：默认的 RAG 检索拿到的是原始源文件，充满了业务逻辑噪音。AI 要从几百行内部代码里反推组件的公开接口。

**这个 MCP 解决的就是这个问题。** 通过 AST 静态分析，只提取公开接口（Props、Events、Slots、注释），以干净的结构化 JSON 提供给 AI。效果等同于给 AI 提供了一份官方 API 文档。

### 功能特性

- **AST 级别提取**：基于 `vue-docgen-api` 和 `react-docgen`，不向模型发送原始源码
- **节省高达 80% Token**：相比直接发送完整组件文件
- **零幻觉**：prop 名称、类型、默认值、必填项全部精准
- **状态管理分析**：支持 Pinia、Vuex、Zustand、Redux Toolkit、Jotai
- **Composables / Hooks 分析**：提取 `useXxx` 函数签名、参数类型、默认值、返回值字段及 JSDoc
- **页面组件树**：递归解析页面文件的完整组件依赖树
- **Auto-import 感知**：自动检测 `unplugin-vue-components` 配置，识别无显式 import 的模板引用
- **TypeScript 类型索引**：提取 `interface`、`type alias`、`enum` 定义的完整成员信息
- **逆向引用查找**：全项目扫描某组件被哪些文件引用
- **路径别名支持**：自动读取 `tsconfig.json`、`vite.config.ts`、`vue.config.js`；别名配置带 mtime 缓存，修改后自动重载无需重启
- **内存 Watch 模式**：文件监听器保持导入索引热更新，查询直接读内存而非磁盘
- **零维护成本**：代码即文档，AI 每次查询都是最新状态

### 安装配置

无需本地安装，直接通过 `npx` 在 AI 客户端中配置。

**Claude Desktop** — 编辑 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "local-component-mcp": {
      "command": "npx",
      "args": ["-y", "@wllcyg001/local-component-mcp"]
    }
  }
}
```

**Cursor** — 设置 → Features → MCP Servers → Add New MCP Server：
- 模式选 `command`
- Name：`local-component-mcp`
- Command：`npx -y @wllcyg001/local-component-mcp`

**Claude Code**：

```bash
claude mcp add local-component-mcp -- npx -y @wllcyg001/local-component-mcp
```

> **本地开发调试：** 克隆仓库后执行 `npm install && npm run build`，再用 `node build/index.js` 启动。

### 工具列表

| 工具 | 说明 |
|------|------|
| `search_components` | 扫描指定目录下的 `.vue` / `.tsx` / `.jsx` 文件，支持关键字过滤 |
| `get_component_detail` | AST 解析组件，返回 Props、Events、Slots、注释及 imports |
| `get_component_usages` | 全项目查找某组件的所有引用位置，含行号。支持 Auto-import 感知。 |
| `search_stores` | 扫描工作区下所有 Pinia / Vuex / Zustand / Redux / Jotai store 文件 |
| `get_store_detail` | 解析 store 文件，返回 state 字段、getters、actions 列表 |
| `search_composables` | 扫描 `composables/` 和 `hooks/` 目录下所有 `useXxx` 函数 |
| `get_composable_detail` | 解析 composable 文件，返回完整函数签名：参数类型、默认值、返回值字段、JSDoc |
| `analyze_page` | 递归解析页面文件的所有组件依赖，返回完整组件树 |
| `search_types` | 扫描 `types/` / `interfaces/` 目录下的 `interface`、`type`、`enum` 定义 |
| `get_type_detail` | 解析类型文件，返回所有成员的字段名、TS 类型、是否可选及 JSDoc 注释 |
| `query_ast` | 高性能的跨语言 AST 模式匹配查询工具。突破正则局限，深度支持解析 `.vue` 单文件组件、JSX/TSX、HTML 及脚本的结构化语义搜索。 |

所有工具均支持**别名路径**（如 `@/components/ProTable.vue`）。

### 典型对话场景

**寻找组件：**
> "帮我扫描 `@/components` 目录，找找有没有跟'人员选择'或'组织架构'相关的组件。"

**精准调用（零幻觉）：**
> "解析 `@/components/ProTable.vue`，然后帮我写一个用户列表页，包含姓名和工号两列，严格使用 ProTable 实际暴露的属性和分页事件。"

**安全重构：**
> "我要把 `MyButton.vue` 的 `size` prop 从字符串改为枚举，帮我查整个项目里哪些文件引用了它，分别传了什么值。"

**修改页面前先了解架构：**
> "用 `analyze_page` 分析 `@/views/OrderDetail.vue`，告诉我这个页面用了哪些组件、层级关系是什么。"

**复用现有业务逻辑：**
> "搜索 `@/composables` 下的所有 hooks，找跟权限或登录相关的，然后给我看那个 hook 的完整参数签名。"

**类型安全的代码生成：**
> "查一下 `@/types/order.ts` 里的 `OrderDetail` 类型定义，然后帮我写一个处理它的函数，不要自己捏造字段。"

**AST 语义级代码搜索（突破正则局限）：**
> "用 `query_ast` 帮我在整个项目中找出所有形如 `const $VAR = ref($VAL)` 的变量声明，或者寻找匹配 `ElMessage.success($MSG)` 的所有函数调用。"

---

## License

MIT
