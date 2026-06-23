# Local Component MCP Server

[中文](#中文) | [English](#english)

---

## 中文

一个专门为前端企业级业务组件（二次封装组件）设计的 **Model Context Protocol (MCP) Server**。

### 🌟 为什么需要它？

在日常使用 Cursor、Claude 等 AI 辅助编码时，默认的代码库检索（RAG）往往会被组件内部长达数百行的复杂业务逻辑、生命周期钩子所污染。这就导致 AI 无法准确获取你的定制组件（如 `<ProTable>`、`<BizSelect>`）究竟有哪些可用的属性。**后果就是：AI 总是胡乱猜测属性名、漏传必填参数（幻觉严重）。**

本插件通过引入 `vue-docgen-api` 与 `react-docgen`，对本地 `.vue`、`.tsx`、`.jsx` 源码进行 **AST（抽象语法树）级别的静态解析**。它直接剥离了所有的业务代码噪音，专门为大模型提供 **100% 纯净、高度结构化**的组件接口（Props, Emits, Slots, 注释）。让 AI 像看官方 API 文档一样，精确无误地调用你项目里的任何本地业务组件！

### 🚀 功能特性

- 💰 **大幅节省 Token 与提升精准度**：通过底层 AST 提取纯粹的结构化元数据（JSON），避免将动辄数百行的组件原始代码直接发送给大模型，节省高达 80% 的 Context Token 消耗，同时有效降低 AI “幻觉”（Hallucination）。
- 🔍 **动态目录扫描**：无需硬编码配置，AI 可根据当前工作区路径，动态扫描并过滤指定目录下的 `.vue`、`.tsx`、`.jsx` 组件或全局状态文件（Store）。
- 📖 **AST 级提炼**：
  - **组件透视**：毫秒级解析源码，精准提取 Props 类型、默认值、必填项、Events 触发事件以及 TSDoc 注释，同时返回完整的依赖导入列表。
  - **状态透视**：深度解析 Vuex / Pinia (Vue) 以及 Zustand / Redux Toolkit / Jotai (React) 配置文件，秒级提取全局 `state`、`getters` 以及 `actions` 的结构，同时支持 Pinia Setup Store 等风格解析。
  - **逆向引用查找**：全项目范围精准检索某个组件被哪些文件引用，极大增强 AI 进行安全重构的能力。
- 🗂 **路径别名支持**：自动读取项目的 `tsconfig.json`、`vite.config.ts`、`vue.config.js` 等配置文件并解析别名，支持 `@/components/Foo.vue` 等别名路径直接作为参数传入。别名配置读取结果带 **mtime 感知缓存**，配置文件修改后自动重新加载，无需重启服务。
- ⚡️ **零维护成本**：代码即文档！只要代码修改，AI 再次查询即是最新状态，永远不需要人工额外维护一份 JSON 配置或 Wiki。

### 📦 安装与配置

发布到 NPM 后，你无需在本地安装，可以直接利用 `npx` 在你的 AI 客户端（如 Claude Desktop 或 Cursor）中配置它。

#### 在 Claude Desktop 中配置
打开你的 `claude_desktop_config.json`，添加如下配置：

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

#### 在 Cursor 中配置
1. 打开 Cursor 设置面板 -> **Features** -> **MCP Servers**
2. 点击 **Add New MCP Server**
3. 选择 **command** 模式
4. Name 填写：`local-component-mcp`
5. Command 填写：`npx -y @wllcyg001/local-component-mcp`

> 💡 **开发环境运行测试**：
> 如果你是在克隆下来的源码目录中，请先执行 `npm install` 与 `npm run build`，然后使用 `node build/index.js` 启动测试。

### 🛠 提供的 Tools

MCP 启动后，会对 AI 暴露以下五个工具：

#### 1. `search_components`
在指定工作区中搜索 Vue/React 组件文件（`.vue`、`.tsx`、`.jsx`），自动跳过 `node_modules`、`dist` 等无关目录。
- **参数**:
  - `workspacePath` (必须): 要扫描的本地目录绝对路径（支持别名路径）。
  - `keyword` (可选): 用于匹配文件名的关键字。
- **返回**: 匹配到的组件文件列表及数量。

#### 2. `get_component_detail`
AST 级别解析指定组件的结构，提取接口规范及依赖信息。
- **参数**:
  - `filePath` (必须): 组件文件路径（支持别名路径，如 `@/components/MyButton.vue`）。
  - `workspacePath` (可选): 项目根目录，用于别名解析；未传时自动向上查找 `package.json`。
- **返回**: 组件的元数据 JSON，包含 Props、Events、Slots、注释及 `imports` 依赖导入列表。

#### 3. `get_component_usages`
在全项目范围内查找某个组件的所有引用位置（逆向依赖分析）。
- **参数**:
  - `componentPath` (必须): 目标组件的路径（支持别名路径，如 `@/components/MyButton.vue`）。
  - `workspacePath` (可选): 扫描工作区根目录；未传时自动向上查找 `package.json`。
- **返回**: 所有引用该组件的文件列表，包含每处引用的行号及代码内容。

#### 4. `search_stores`
自动扫描指定工作区下的所有全局状态定义文件。
- **参数**:
  - `workspacePath` (必须): 项目工作区的绝对路径。
  - `storesPath` (可选): 直接指定 store 目录；未传时按 `src/store` → `src/stores` → `src/modules/*/store` 顺序自动检测。
- **返回**: 匹配到的 Store 文件列表及数量。

#### 5. `get_store_detail`
利用 Babel AST 解析 Vuex / Pinia 或 Zustand / Redux Toolkit / Jotai 的 Store 文件。
- **参数**:
  - `filePath` (必须): Store 文件路径（支持别名路径）。
  - `workspacePath` (可选): 项目根目录，用于别名解析；未传时自动向上查找。
- **返回**: 包含 `state`、`getters`、`actions` 字段名列表以及 `imports` 依赖导入列表的 JSON。

### 👨‍💻 典型对话场景示例

* **场景 1（寻找轮子）**：
  > "帮我看看 `D:/projects/my-vue-app/src/components` 这个目录下，有没有跟'人员选择'或者'组织架构'相关的组件？"

* **场景 2（精准调用组件，零幻觉）**：
  > "解析一下 `@/components/ProTable.vue` 这个组件，然后帮我写一个【用户列表页】。表格包含姓名、工号两列，并严格使用 `ProTable` 暴露出来的属性和分页事件进行数据绑定。"

* **场景 3（安全重构）**：
  > "我要把 `MyButton.vue` 的 `size` prop 从字符串改为枚举，帮我查一下整个项目里哪些文件用到了这个组件，以及分别传了什么参数，再统一修改。"

---

## English

A **Model Context Protocol (MCP) Server** specifically designed for enterprise-level front-end business components (wrapper components).

### 🌟 Why do you need this?

When using AI coding assistants like Cursor or Claude, default codebase retrieval (RAG) is often polluted by hundreds of lines of complex business logic and lifecycle hooks inside your components. This prevents AI from accurately understanding the available properties of your custom components (e.g., `<ProTable>`, `<BizSelect>`). **The result: AI constantly hallucinates property names or misses required parameters.**

This plugin introduces `vue-docgen-api` and `react-docgen` to perform **AST (Abstract Syntax Tree) level static analysis** on local `.vue`, `.tsx`, and `.jsx` source code. It strips away all business code noise, providing LLMs with **100% pure, highly structured** component interfaces (Props, Emits, Slots, Comments). It enables AI to call any local business component in your project as accurately as reading official API documentation!

### 🚀 Features

- 💰 **Massive Token Savings & Enhanced Accuracy**: By extracting pure structured metadata (JSON) via underlying AST parsing, it avoids feeding hundreds of lines of raw component code to LLMs. This saves up to 80% of Context Token consumption and effectively mitigates AI hallucinations.
- 🔍 **Dynamic Directory Scanning**: No hardcoded configuration needed. AI can dynamically scan and filter components (`.vue`, `.tsx`, `.jsx`) or global state files (Stores) in specified directories based on the current workspace path.
- 📖 **AST-Level Extraction**:
  - **Component X-Ray**: Parses source code in milliseconds, accurately extracting Prop types, default values, required fields, emitted Events, and TSDoc comments, while returning a complete list of import dependencies.
  - **State X-Ray**: Deeply parses Vuex / Pinia (Vue) and Zustand / Redux Toolkit / Jotai (React) configuration files, extracting the structure of global `state`, `getters`, and `actions` in seconds.
  - **Reverse Usage Lookup**: Accurately retrieves which files reference a specific component across the entire project, enhancing the AI's ability to perform safe refactoring.
- 🗂 **Path Alias Support**: Automatically reads project configuration files (`tsconfig.json`, `vite.config.ts`, `vue.config.js`) to resolve aliases, supporting paths like `@/components/Foo.vue`. Features **mtime-aware caching**, auto-reloading configurations upon changes without restarting the service.
- ⚡️ **Zero Maintenance Cost**: Code is documentation! As long as the code is updated, the next AI query will reflect the latest state. You'll never need to manually maintain extra JSON configurations or Wikis.

### 📦 Installation & Configuration

Once published to NPM, you don't need to install it locally. You can configure it directly using `npx` in your AI client (like Claude Desktop or Cursor).

#### Configure in Claude Desktop
Open your `claude_desktop_config.json` and add the following configuration:

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

#### Configure in Cursor
1. Open Cursor Settings -> **Features** -> **MCP Servers**
2. Click **Add New MCP Server**
3. Select **command** mode
4. Name: `local-component-mcp`
5. Command: `npx -y @wllcyg001/local-component-mcp`

> 💡 **Running tests in development**:
> If you are in the cloned source directory, run `npm install` and `npm run build` first, then start testing using `node build/index.js`.

### 🛠 Available Tools

Once the MCP is started, it exposes the following five tools to the AI:

#### 1. `search_components`
Searches for Vue/React component files (`.vue`, `.tsx`, `.jsx`) in the specified workspace, automatically skipping irrelevant directories.
- **Params**:
  - `workspacePath` (required): The absolute path of the local directory to scan (supports alias paths).
  - `keyword` (optional): Keyword for filtering file names.
- **Returns**: A list and count of matched component files.

#### 2. `get_component_detail`
AST-level structural analysis of the specified component, extracting interface specifications and dependency information.
- **Params**:
  - `filePath` (required): The component file path (supports alias paths, e.g., `@/components/MyButton.vue`).
  - `workspacePath` (optional): The project root directory for alias resolution; if not provided, it automatically searches upwards for `package.json`.
- **Returns**: Metadata JSON of the component, including Props, Events, Slots, comments, and `imports` dependency list.

#### 3. `get_component_usages`
Finds all usage locations of a specific component across the entire project (reverse dependency analysis).
- **Params**:
  - `componentPath` (required): The path of the target component (supports alias paths).
  - `workspacePath` (optional): The workspace root directory to scan; if not provided, it automatically searches upwards.
- **Returns**: A list of all files referencing the component, including the line number and code content for each reference.

#### 4. `search_stores`
Automatically scans all global state definition files under the specified workspace.
- **Params**:
  - `workspacePath` (required): The absolute path of the project workspace.
  - `storesPath` (optional): Directly specify the store directory.
- **Returns**: A list and count of matched Store files.

#### 5. `get_store_detail`
Uses Babel AST to parse Store files of Vuex / Pinia or Zustand / Redux Toolkit / Jotai.
- **Params**:
  - `filePath` (required): The Store file path (supports alias paths).
  - `workspacePath` (optional): The project root directory for alias resolution; if not provided, it automatically searches upwards.
- **Returns**: A JSON containing arrays of `state`, `getters`, `actions` field names, and an `imports` dependency list.

### 👨‍💻 Typical Conversation Scenarios

* **Scenario 1 (Finding the wheel)**:
  > "Help me check if there are any components related to 'personnel selection' or 'organization chart' under the `D:/projects/my-vue-app/src/components` directory?"

* **Scenario 2 (Accurate component calling, zero hallucinations)**:
  > "Parse the `@/components/ProTable.vue` component, and then help me write a [User List Page]. The table should contain two columns: name and employee ID, and strictly use the properties and pagination events exposed by `ProTable` for data binding."

* **Scenario 3 (Safe refactoring)**:
  > "I want to change the `size` prop of `MyButton.vue` from a string to an enum. Please find out which files in the entire project use this component, what parameters are passed respectively, and then help me modify them all uniformly."

---

## 📄 License
MIT
