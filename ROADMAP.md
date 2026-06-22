# 🚀 研发路线图 (Roadmap & Backlog)

本文档记录了 `local-component-mcp` 未来的扩展规划。基于目前成熟的“AST 解析 + 内存索引 + 别名处理”底层架构，我们将逐步把工具的感知能力从“组件级”提升至“全工程架构级”，为 AI 打造最高效的本地代码上下文降噪引擎。

---

## 🟢 近期规划 (High Priority)

### 1. ⚛️ 全面支持 React 生态
**目标**：打破 Vue 的框架限制，实现 Vue/React 双端制霸。
- **具体实现**：
  - 在 `get_component_detail` 中引入 `react-docgen` 或 `react-docgen-typescript`。
  - 通过文件扩展名（`.vue` vs `.tsx/.jsx`）进行底层解析引擎的自动分流。
  - 产出统一的结构化 JSON（将 PropTypes/TS Interfaces 标准化输出）。
- **价值**：将用户群体和适用场景扩大一倍，彻底解决 React 项目中高阶组件（HOC）和复杂 Hooks 的 AI 幻觉问题。

### 2. 🗃️ 扩展状态管理支持 (React 阵营)
**目标**：让状态透视能力支持 React 主流生态。
- **具体实现**：
  - 在 `search_stores` 和 `get_store_detail` 中，新增对 `Zustand` (`create(...)`)、`Redux Toolkit` (`createSlice`) 和 `Jotai` 的 AST 解析支持。

---

## 🔴 远期愿景 (Long-term Vision)

### 6. 🎨 设计系统 Token 桥接 (Design System Tokens)
**目标**：对齐公司的 UI 规范，限制 AI 的 CSS 生成自由度。
- **具体实现**：解析全局 SCSS/Less 变量文件，或解析 `tailwind.config.js` 的主题配置。
- **价值**：防止 AI 写出 `#ff0000` 这样的绝对颜色，强制其输出 `var(--color-primary)` 或对应的原子类，保障生成的 UI 视觉一致性。

### 7. 🏗️ 重构级影响半径图谱 (Refactoring Impact Graph)
**目标**：为大型应用的底层重构提供安全保障。
- **具体实现**：基于当前的 `get_component_usages` 向上一层层递归，直至路由层级。
- **价值**：输出一个完整的树状依赖图谱（Tree Graph）。如果修改了底层的 `<BaseTable>`，AI 能直接报告：“此修改将影响 5 个业务模块、12 个页面路由，已标记高风险”。
