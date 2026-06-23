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
- **Reverse usage lookup** — find every file that imports a given component
- **Path alias support** — reads `tsconfig.json`, `vite.config.ts`, `vue.config.js` automatically; alias config is cached with mtime awareness and reloads without restart
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
| `get_component_usages` | Find every file that imports a given component, with line numbers |
| `search_stores` | Scan a workspace for Pinia / Vuex / Zustand / Redux store files |
| `get_store_detail` | Parse a store file and return its state fields, getters, and actions |

All tools support **alias paths** (e.g., `@/components/ProTable.vue`).

### Usage Examples

**Find a component:**
> "Search `/home/user/projects/my-app/src/components` for anything related to 'organization' or 'user picker'."

**Use a component correctly:**
> "Parse `@/components/ProTable.vue`, then write a User List page with name and employee ID columns. Use only the props and pagination events that ProTable actually exposes."

**Safe refactoring:**
> "I'm changing the `size` prop of `MyButton.vue` from a string to an enum. Find every file in the project that uses this component and show me what value they're passing to `size`."

### 🗺️ Coming Soon / Roadmap

We are continuously expanding the capabilities of this MCP server. Key features under planning include:
- **Router Map Analysis** — indexing `vue-router` / `react-router` definitions.
- **I18n Translation Keys Discovery** — reverse searching translation keys for AI generation.
- **API Endpoints Discovery** — exposing API fetch signatures and schemas.
- **Utils & Hooks Discovery** — scanning common hooks to reuse logic.
- **Design System Tokens Integration** — bridging design variables.

Check out our [ROADMAP.md](ROADMAP.md) for details.

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
- **逆向引用查找**：全项目扫描某组件被哪些文件引用
- **路径别名支持**：自动读取 `tsconfig.json`、`vite.config.ts`、`vue.config.js`；别名配置带 mtime 缓存，修改后自动重载无需重启
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
| `get_component_usages` | 全项目查找某组件的所有引用位置，含行号 |
| `search_stores` | 扫描工作区下所有 Pinia / Vuex / Zustand / Redux store 文件 |
| `get_store_detail` | 解析 store 文件，返回 state 字段、getters、actions 列表 |

所有工具均支持**别名路径**（如 `@/components/ProTable.vue`）。

### 典型对话场景

**寻找组件：**
> "帮我扫描 `@/components` 目录，找找有没有跟'人员选择'或'组织架构'相关的组件。"

**精准调用（零幻觉）：**
> "解析 `@/components/ProTable.vue`，然后帮我写一个用户列表页，包含姓名和工号两列，严格使用 ProTable 实际暴露的属性和分页事件。"

**安全重构：**
> "我要把 `MyButton.vue` 的 `size` prop 从字符串改为枚举，帮我查整个项目里哪些文件引用了它，分别传了什么值。"

### 🗺️ 近期路线图 (Roadmap)

我们正在积极扩展该 MCP Server 的能力，计划在后续版本引入：
- **路由映射分析** — 解析 `vue-router` / `react-router` 的配置文件。
- **I18n 字典解析** — 逆向搜索多语言 Key，消除 AI 硬编码。
- **API 服务发现** — 解析项目中的接口请求签名与入参结构。
- **Hooks 与公用函数发现** — 扫描公共函数与自定义 Hooks。
- **设计系统变量对接** — 引入 Design Tokens 规范。

更详尽的排期与状态请参考 [ROADMAP.md](ROADMAP.md)。

---

## License

MIT
