/**
 * MCP Tool JSON Schema 声明
 */
export const toolSchemas = [
  {
    name: "search_components",
    description:
      "在指定的本地工作区目录中搜索 Vue/React 组件文件（.vue、.tsx、.jsx）。",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: {
          type: "string",
          description: "要扫描的工作区或组件目录的绝对路径。",
        },
        keyword: {
          type: "string",
          description: "按文件名过滤组件的关键词（可选）。",
        },
      },
      required: ["workspacePath"],
    },
  },
  {
    name: "get_component_detail",
    description:
      "解析组件文件（.vue、.tsx、.jsx），提取其 Props、Events、Slots、依赖项及其他元数据。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "要解析的 .vue、.tsx 或 .jsx 文件的路径（支持别名路径）。",
        },
        workspacePath: {
          type: "string",
          description:
            "（可选）项目根目录的绝对路径，用于别名解析。未传时自动向上查找。",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "get_component_usages",
    description:
      "在工作区中查找某个组件的所有引用位置（包括 import 导入、模板标签调用及脚本变量引用）。自动感知 unplugin-vue-components 自动注册的组件。",
    inputSchema: {
      type: "object",
      properties: {
        componentPath: {
          type: "string",
          description:
            "目标组件文件的绝对路径、相对路径或别名路径（如 '@/components/MyButton.vue'）。",
        },
        workspacePath: {
          type: "string",
          description:
            "（可选）要扫描的工作区根目录的绝对路径。未传时自动向上查找 package.json 所在目录。",
        },
      },
      required: ["componentPath"],
    },
  },
  {
    name: "search_stores",
    description:
      "在指定的本地工作区目录中搜索 Vuex 或 Pinia store 文件。支持多种目录布局自动检测。",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: {
          type: "string",
          description: "要扫描的工作区根目录的绝对路径。",
        },
        storesPath: {
          type: "string",
          description:
            "（可选）直接指定 store 目录路径。未传时按 src/store → src/stores → src/modules/*/store 顺序自动检测。",
        },
      },
      required: ["workspacePath"],
    },
  },
  {
    name: "get_store_detail",
    description:
      "解析 Vuex/Pinia store 文件，提取其 state、getters、actions 及依赖项（支持 Option Store 和 Setup Store 语法）。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "要解析的 store 文件路径（支持别名路径）。",
        },
        workspacePath: {
          type: "string",
          description:
            "（可选）项目根目录的绝对路径，用于别名解析。未传时自动向上查找。",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "search_composables",
    description:
      "在工作区的 composables/ 或 hooks/ 目录中搜索所有 useXxx 风格的 Composable / Hook 函数，返回名称、文件路径及参数/返回值数量预览。",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: {
          type: "string",
          description: "要扫描的工作区根目录的绝对路径。",
        },
        keyword: {
          type: "string",
          description: "按函数名或文件名过滤的关键词（可选）。",
        },
      },
      required: ["workspacePath"],
    },
  },
  {
    name: "get_composable_detail",
    description:
      "解析单个 Composable / Hook 文件，提取所有 useXxx 函数的完整签名（参数名、类型、默认值）、返回值列表及 JSDoc 描述，帮助 AI 精确理解业务逻辑 Hook。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "要解析的 .ts/.tsx/.js 文件路径（支持别名路径）。",
        },
        workspacePath: {
          type: "string",
          description: "（可选）项目根目录的绝对路径，用于别名解析。",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "analyze_page",
    description:
      "分析一个页面文件（.vue/.tsx/.jsx），递归解析其完整组件依赖树，包含每个子组件的文件路径和层级关系。帮助 AI 在修改页面前全面理解其架构。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "页面文件的绝对路径或别名路径（如 '@/views/Home.vue'）。",
        },
        workspacePath: {
          type: "string",
          description: "（可选）项目根目录的绝对路径，用于别名解析。",
        },
        maxDepth: {
          type: "number",
          description: "最大递归深度，默认 5，最大 10。",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "search_types",
    description:
      "在工作区的 types/、interfaces/ 等目录中搜索所有 TypeScript 类型定义（interface、type alias、enum），返回名称、种类及文件位置预览。",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: {
          type: "string",
          description: "要扫描的工作区根目录的绝对路径。",
        },
        keyword: {
          type: "string",
          description: "按类型名或文件名过滤的关键词（可选）。",
        },
      },
      required: ["workspacePath"],
    },
  },
  {
    name: "get_type_detail",
    description:
      "解析单个 TypeScript 类型文件，提取其中所有 interface、type alias、enum 的完整成员定义（字段名、类型、是否可选、JSDoc 注释），帮助 AI 生成类型准确的代码。",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "要解析的 .ts 文件路径（支持别名路径）。",
        },
        typeName: {
          type: "string",
          description: "（可选）只返回指定名称的类型定义，未传则返回文件中所有定义。",
        },
        workspacePath: {
          type: "string",
          description: "（可选）项目根目录的绝对路径，用于别名解析。",
        },
      },
      required: ["filePath"],
    },
  },
];
