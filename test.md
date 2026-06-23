# 基于 AST 静态解析解决 AI 编码助手中的私有组件属性幻觉

## 1. 背景与问题定义

在使用 Cursor、Claude 等 AI 辅助编码工具开发前端业务时，开发者经常遇到 AI 生成的代码中组件属性（Props）、事件（Events）以及插槽（Slots）调用错误的问题。例如：将 Vue 的 kebab-case 属性误写为 camelCase、使用不存在的事件名称，或者遗漏了必填参数。

这一现象的根源在于 AI 编码工具底层的 **RAG（检索增强生成）机制**：
*   当开发者要求 AI 调用某个本地组件（如封装的 `<ProTable>`）时，RAG 会检索并读取该组件的源文件（`.vue`、`.tsx` 或 `.jsx`）。
*   然而，一个业务组件源文件中通常有 80% 以上的代码属于内部业务逻辑、生命周期钩子、状态维护和渲染模板，这些内容对于“如何调用该组件”而言属于**噪音**。
*   AI 必须从包含大量噪音的源码中推断出组件的公开接口，这极大增加了模型推导的负担，从而导致频繁的属性幻觉。

要解决这一问题，AI 需要的不是完整的组件源码，而是一份结构化、纯净的 **API 接口声明文档**。

---

## 2. 核心方案：AST 静态解析与结构化数据供给

为了消除源码噪音，我们开发了基于 MCP（Model Context Protocol）协议的工具：`local-component-mcp`。该工具的核心思路是：**通过 AST（抽象语法树）静态解析，剥离组件的内部实现，仅提取公开的接口描述并以标准 JSON 格式供给 AI**。

本工具引入了 `vue-docgen-api` 和 `react-docgen` 解析引擎，对本地组件文件进行静态分析，提取包括组件名、说明、Props（包含类型、默认值、是否必填、注释描述）、Events 以及 Slots 在内的元数据。

以下为解析后输出的结构化 JSON 示例：

```json
{
  "props": {
    "api": {
      "type": { "name": "Function" },
      "required": true,
      "description": "数据请求函数，需返回 { list, total }"
    },
    "columns": {
      "type": { "name": "ColumnConfig[]" },
      "required": true,
      "description": "列配置数组"
    },
    "pageSize": {
      "type": { "name": "number" },
      "defaultValue": { "value": "20" },
      "required": false
    }
  },
  "events": {
    "page-change": { "description": "页码变化时触发" }
  },
  "slots": {
    "toolbar": { "description": "工具栏插槽" }
  }
}
```

通过这一方式，AI 能够直接阅读精准的接口定义，从而在生成组件调用代码时保证高度准确性。

---

## 3. 功能架构与工具链设计

该 MCP Server 运行后，会向 AI 编码客户端暴露 5 个功能工具，覆盖从组件检索到逆向依赖分析的全流程：

### 3.1 `search_components` (组件检索)
*   **功能**：在指定的工作区目录中扫描所有的 `.vue`、`.tsx`、`.jsx` 文件，支持根据关键字过滤文件名。自动忽略 `node_modules`、`dist` 等无关目录。
*   **用途**：帮助 AI 发现项目中已有的通用或业务组件。

### 3.2 `get_component_detail` (组件接口分析)
*   **功能**：对指定组件文件执行 AST 静态分析，提取 Props、Events、Slots 及其注释，并解析其依赖导入列表（`imports`）。支持传入项目路径别名（如 `@/components/Foo.vue`）。
*   **用途**：在 AI 生成组件调用代码前，为其提供精准的 API 定义。

### 3.3 `get_component_usages` (逆向引用查找)
*   **功能**：在全项目内检索某个组件被引用的所有位置。返回结果包含文件路径、行号及代码片段。支持识别重命名导入和 kebab-case 标签格式。
*   **用途**：协助 AI 进行重构分析，评估修改组件属性所带来的影响范围。

### 3.4 `search_stores` (状态管理检索)
*   **功能**：自动扫描工作区目录下的全局状态定义文件。支持按常见路径规则自动匹配或手动指定扫描路径。

### 3.5 `get_store_detail` (状态管理接口分析)
*   **功能**：利用 Babel AST 静态分析全局状态管理文件（支持 Vuex、Pinia、Zustand、Redux Toolkit 以及 Jotai），提取暴露的 `state`、`getters` 和 `actions` 字段名结构。
*   **用途**：使 AI 能够准确调用全局状态，避免拼写错误或调用不存在的方法。

---

## 4. 关键技术细节

为了确保在实际开发中的性能与体验，工具在底层设计上实现了以下优化：

1.  **路径别名解析与缓存（mtime 感知）**：
    自动读取项目中的 `tsconfig.json`、`vite.config.ts` 或 `vue.config.js` 配置文件并映射别名路径。为了避免频繁读取配置带来的性能开销，系统建立了别名配置缓存，并基于文件修改时间（`mtime`）进行增量更新。当配置文件被修改时，系统会自动重载，无需手动重启 MCP 服务。
2.  **大幅降低 Token 消耗**：
    一个 200 行左右的 Vue 组件源码通常包含 1500+ token。经过 AST 提取和压缩后，其结构化的元数据仅占 200 个左右的 token，且保留了调用所需的全部关键信息。这使得每次上下文传递的 Token 占用降低了 80% 以上，提高了大语言模型的响应速度并降低了 API 消耗。
3.  **零人工维护成本**：
    采用静态分析源码的方式，使代码本身成为唯一的真理源。当组件更新时，AI 实时获取到的都是最新解析的接口，无需开发者额外维护任何文档或配置文件。

---

## 5. 安装与配置

本工具已发布至 NPM 镜像源，可直接通过 `npx` 运行，无需在本地环境中手动安装。

### 5.1 Cursor 配置
在 Cursor 的 **Settings** -> **Features** -> **MCP Servers** 中，点击 **Add New MCP Server** 并填写以下信息：
*   **Name**: `local-component-mcp`
*   **Type**: `command`
*   **Command**: `npx -y @wllcyg001/local-component-mcp`

### 5.2 Claude Desktop 配置
在 `claude_desktop_config.json` 配置文件中的 `mcpServers` 节点下添加以下配置：
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

### 5.3 Claude Code 配置
在终端执行以下命令进行添加：
```bash
claude mcp add local-component-mcp -- npx -y @wllcyg001/local-component-mcp
```

---

## 6. 适用场景与总结

`local-component-mcp` 的核心目标是提升 AI 编码助手对私有代码库中定制化业务组件的调用准确度。

*   **适用场景**：中大型前端协作项目，特别是项目内部大量封装了自定义业务组件（如基于开源 UI 框架二次封装的通用组件）的场景。
*   **不适用场景**：完全直接引用开源组件库（没有进行任何业务组件封装）的小型项目。

目前，本工具已实现对 **Vue 2/3** 以及 **React (TypeScript/JavaScript)** 组件的全面兼容，状态管理解析也已覆盖 Vuex、Pinia、Zustand、Redux Toolkit 和 Jotai。

*   **GitHub 仓库**：[wllcyg/local-component-mcp](https://github.com/wllcyg/local-component-mcp)
*   **NPM 包地址**：[@wllcyg001/local-component-mcp](https://www.npmjs.com/package/@wllcyg001/local-component-mcp)

若在实际使用中遇到解析异常或有任何改进建议，欢迎在 GitHub 仓库提交 Issue 进行反馈。