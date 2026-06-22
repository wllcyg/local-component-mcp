# 🚀 研发路线图 (Roadmap & Backlog)

本文档记录了 `local-component-mcp` 的研发历程以及未来的扩展规划。基于目前成熟的“AST 解析 + 内存索引 + 别名处理”底层架构，我们将逐步把工具的感知能力从“组件级”提升至“全工程架构级”，为 AI 打造最高效的本地代码上下文降噪引擎。

---

## ✅ 已完成 (Completed)

### 1. ⚛️ 全面支持 React 生态 (v1.2.0)
- **实现内容**：
  - 在 `get_component_detail` 中引入 `react-docgen`，实现 Vue/React 双端并存解析。
  - 支持通过文件扩展名（`.vue` vs `.tsx/.jsx`）自动分流解析引擎。
  - 产出统一的结构化 JSON 规范，精准提取 React 组件的 Props 类型、默认值、必填项、TS 接口/签名及 JSDoc 注释。

### 2. 🗃️ 扩展状态管理支持 (React 阵营) (v1.2.0)
- **实现内容**：
  - 在 `search_stores` 和 `get_store_detail` 中，新增对 React 主流生态 `Zustand` (`create(...)`)、`Redux Toolkit` (`createSlice`) 和 `Jotai` (`atom`) 的 AST 解析支持。
  - 将 store 扫描范围扩展至 `.tsx` 与 `.jsx` 文件。

### 3. 🔍 逆向引用分析与查找 (v1.1.0)
- **实现内容**：
  - 新增 `get_component_usages` 工具，实现全项目文件引用分析。
  - 支持脚本顶部 import 导入语句、模板/JSX 标签（PascalCase/kebab-case）和脚本变量引用三类引用类型的精准捕获。

### 4. 🗂️ 路径别名解析与缓存机制 (v1.1.0)
- **实现内容**：
  - 支持自动检测并解析 `tsconfig.json`、`vite.config.ts`、`vue.config.js` 的别名配置。
  - 引入基于 `mtime` 的增量刷新机制，配置文件修改后自动刷新，无需重启 MCP 服务。

---

## 🟡 中期规划 (Medium Priority)

### 1. 🗺️ 路由映射透视 (Router Map Analysis)
- **目标**：让 AI 掌握全站的页面跳转地图。
- **工具名称**：`get_router_map`
- **具体实现**：解析 `vue-router` 或 `react-router` 的配置文件，提取 `path`、`name`、`component` 及动态参数（Params/Query）。
- **价值**：AI 生成跳转代码时（如 `router.push` 或 `useNavigate`），能精准传入正确的路由名称和必填参数，不再凭空捏造不存在的 URL。

### 2. 🌍 国际化字典解析 (I18n Translation Keys)
- **目标**：消灭 AI 生成代码时的硬编码中文字符串。
- **工具名称**：`search_i18n`
- **具体实现**：读取并解析 `vue-i18n` 或 `react-i18next` 的 `locales/*.json` 或 TS 字典文件。
- **价值**：AI 可根据自然语言（中文文案），自动逆向搜索出对应的英文 Key，直接生成标准的 `$t('user.login.submit')` 代码。

### 3. 🔌 API 服务发现层 (API Endpoints Discovery)
- **目标**：让 AI 自动发现并精准调用本地封装的 API 请求函数。
- **工具名称**：`search_api` / `get_api_detail`
- **具体实现**：扫描 `src/api` 或 `src/services` 目录，解析 Axios 封装或自动生成的 API 模块，提炼出每个请求函数的名称、URL、入参格式、Method 和返回值。
- **价值**：AI 写接口调用逻辑时，可直接导入正确的 API 函数（如 `import { getUserList } from '@/api/user'`），且能保证 Request Payload 完全满足后端格式要求。

### 4. 🧰 公共工具与 Hooks 透视 (Utils & Composables Discovery)
- **目标**：防止 AI 重复造轮子，强制复用本地公共逻辑。
- **工具名称**：`search_utils` / `get_composable_detail`
- **具体实现**：扫描 `src/utils` 和 `src/composables` (或 `src/hooks`) 目录，提取暴露的纯函数和自定义 Hook 的入参、返回值及注释说明。
- **价值**：当 AI 需要格式化时间、防抖、或获取页面宽高等操作时，能直接发现并调用本地公共逻辑（如 `import { useWindowSize } from '@/composables/useWindowSize'`），而不是自己手写一套冗余代码。

### 5. 🖼️ 静态资源与图标索引 (Assets & Icons Indexing)
- **目标**：让 AI 精准调用本地的 SVG 图标和静态图片。
- **工具名称**：`search_icons`
- **具体实现**：扫描 `src/assets/icons` 或类似的 SVG 目录，暴露本地所有可用图标的名称。
- **价值**：AI 生成 UI 时，能准确使用本地已有的图标，不再自己胡乱猜名或者下载重复的图标资产。

---

## 🔴 远期愿景 (Long-term Vision)

### 1. 🎨 设计系统 Token 桥接 (Design System Tokens)
- **目标**：对齐公司的 UI 规范，限制 AI 的 CSS 生成自由度。
- **具体实现**：解析全局 SCSS/Less 变量文件，或解析 `tailwind.config.js` 的主题配置。
- **价值**：防止 AI 写出 `#ff0000` 这样的绝对颜色，强制其输出 `var(--color-primary)` 或对应的原子类，保障生成的 UI 视觉一致性。

### 2. 🏗️ 重构级影响半径图谱 (Refactoring Impact Graph)
- **目标**：为大型应用的底层重构提供安全保障。
- **具体实现**：基于当前的 `get_component_usages` 向上一层层递归，直至路由层级。
- **价值**：输出一个完整的树状依赖图谱（Tree Graph）。如果修改了底层的 `<BaseTable>`，AI 能直接报告：“此修改将影响 5 个业务模块、12 个页面路由，已标记高风险”。
