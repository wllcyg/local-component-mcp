# Local Component MCP Server

一个专门为前端企业级业务组件（二次封装组件）设计的 **Model Context Protocol (MCP) Server**。

## 🌟 为什么需要它？

在日常使用 Cursor、Claude 等 AI 辅助编码时，默认的代码库检索（RAG）往往会被组件内部长达数百行的复杂业务逻辑、生命周期钩子所污染。这就导致 AI 无法准确获取你的定制组件（如 `<ProTable>`、`<BizSelect>`）究竟有哪些可用的属性。**后果就是：AI 总是胡乱猜测属性名、漏传必填参数（幻觉严重）。**

本插件通过引入 `vue-docgen-api`，对本地 `.vue` 源码进行 **AST（抽象语法树）级别的静态解析**。它直接剥离了所有的业务代码噪音，专门为大模型提供 **100% 纯净、高度结构化**的组件接口（Props, Emits, Slots, 注释）。让 AI 像看官方 API 文档一样，精确无误地调用你项目里的任何本地业务组件！

## 🚀 功能特性

- 🔍 **动态目录扫描**：无需硬编码配置，AI 可根据当前工作区路径，动态扫描并过滤指定目录下的 `.vue` 组件。
- 📖 **AST 级提炼**：毫秒级解析源码，精准提取 Props 类型、默认值、必填项、Events 触发事件以及 TSDoc 注释。
- ⚡️ **零维护成本**：代码即文档！只要代码修改，AI 再次查询即是最新状态，永远不需要人工额外维护一份 JSON 配置或 Wiki。

## 📦 安装与配置

发布到 NPM 后，你无需在本地安装，可以直接利用 `npx` 在你的 AI 客户端（如 Claude Desktop 或 Cursor）中配置它。

### 在 Claude Desktop 中配置
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

### 在 Cursor 中配置
1. 打开 Cursor 设置面板 -> **Features** -> **MCP Servers**
2. 点击 **Add New MCP Server**
3. 选择 **command** 模式
4. Name 填写：`local-component-mcp`
5. Command 填写：`npx -y @wllcyg001/local-component-mcp`

> 💡 **开发环境运行测试**：
> 如果你是在克隆下来的源码目录中，请先执行 `npm install` 与 `npm run build`，然后使用 `node build/index.js` 启动测试。

## 🛠 提供的 Tools

MCP 启动后，会对 AI 暴露以下两个强大的工具：

### 1. `search_components`
用于模糊搜索指定工作区下的可用组件。
- **参数**: 
  - `workspacePath` (必须): 要扫描的本地绝对路径目录。
  - `keyword` (可选): 用于匹配文件名的关键字。
- **返回**: 匹配到的绝对路径文件列表。

### 2. `get_component_detail`
用于精准解析指定组件的底层结构规范。
- **参数**:
  - `filePath` (必须): 组件的绝对路径。
- **返回**: 组件的元数据 JSON，包含所有的 Props、Events、Slots 以及开发者注释。

## 👨‍💻 典型对话场景示例

配置好 MCP 之后，你可以直接在对话框中尝试对 AI 说：

* **场景 1（寻找轮子）**：
  > “帮我看看 `D:/projects/my-vue-app/src/components` 这个目录下，有没有跟‘人员选择’或者‘组织架构’相关的组件？”

* **场景 2（精准调用零幻觉）**：
  > “解析一下 `ProTable.vue` 这个组件，然后帮我写一个【用户列表页】。表格包含姓名、工号两列，并严格使用 `ProTable` 暴露出来的属性和分页事件进行数据绑定。”

## 📄 License
MIT
