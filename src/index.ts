#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { parse } from "vue-docgen-api";
import * as fs from "fs";
import * as path from "path";
import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default || _traverse;

// 递归获取目录下所有的 .vue 文件
function getVueFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getVueFiles(filePath, fileList);
    } else if (filePath.endsWith(".vue")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const server = new Server(
  {
    name: "local-component-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_components",
        description:
          "Search for Vue components (.vue files) in a specified local directory workspace.",
        inputSchema: {
          type: "object",
          properties: {
            workspacePath: {
              type: "string",
              description: "The absolute path of the workspace or components directory to scan.",
            },
            keyword: {
              type: "string",
              description: "Keyword to filter component file names.",
            },
          },
          required: ["workspacePath"],
        },
      },
      {
        name: "get_component_detail",
        description:
          "Parse a Vue component file to extract its Props, Events, Slots, and other metadata.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute path of the .vue file to parse.",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "search_stores",
        description: "Search for Vuex or Pinia store files in a specified local directory workspace.",
        inputSchema: {
          type: "object",
          properties: {
            workspacePath: {
              type: "string",
              description: "The absolute path of the workspace to scan for stores.",
            },
          },
          required: ["workspacePath"],
        },
      },
      {
        name: "get_store_detail",
        description: "Parse a Vuex/Pinia store file to extract its state, getters, and actions.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute path of the store file to parse.",
            },
          },
          required: ["filePath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_components") {
      const workspacePath = String(args?.workspacePath || "");
      const keyword = String(args?.keyword || "").toLowerCase();

      if (!fs.existsSync(workspacePath)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Workspace path does not exist: ${workspacePath}`
        );
      }

      const allVueFiles = getVueFiles(workspacePath);
      let matchedFiles = allVueFiles;
      
      if (keyword) {
        matchedFiles = allVueFiles.filter((file) =>
          path.basename(file).toLowerCase().includes(keyword)
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              count: matchedFiles.length,
              files: matchedFiles,
            }, null, 2),
          },
        ],
      };
    }

    if (name === "get_component_detail") {
      const filePath = String(args?.filePath || "");

      if (!fs.existsSync(filePath)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `File does not exist: ${filePath}`
        );
      }

      if (!filePath.endsWith(".vue")) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Only .vue files are supported. Received: ${filePath}`
        );
      }

      // Parse the Vue component
      const componentDoc = await parse(filePath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(componentDoc, null, 2),
          },
        ],
      };
    }

    if (name === "search_stores") {
      const workspacePath = String(args?.workspacePath || "");
      if (!fs.existsSync(workspacePath)) {
        throw new McpError(ErrorCode.InvalidParams, `Workspace path does not exist: ${workspacePath}`);
      }
      
      // 智能寻找 src/store 或 src/stores 目录
      const storeDir = path.join(workspacePath, 'src', 'store');
      const storesDir = path.join(workspacePath, 'src', 'stores');
      const targetDir = fs.existsSync(storeDir) ? storeDir : fs.existsSync(storesDir) ? storesDir : '';
      
      let storeFiles: string[] = [];
      if (targetDir) {
        const getFiles = (dir: string, fileList: string[] = []) => {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
              getFiles(filePath, fileList);
            } else if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
              fileList.push(filePath);
            }
          }
          return fileList;
        };
        storeFiles = getFiles(targetDir);
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ count: storeFiles.length, files: storeFiles }, null, 2) }]
      };
    }

    if (name === "get_store_detail") {
      const filePath = String(args?.filePath || "");
      if (!fs.existsSync(filePath)) {
        throw new McpError(ErrorCode.InvalidParams, `File does not exist: ${filePath}`);
      }
      
      const code = fs.readFileSync(filePath, 'utf-8');
      // 解析 AST
      const ast = babelParser.parse(code, { sourceType: 'module', plugins: ['typescript'] });
      
      const storeInfo = { 
        state: [] as string[], 
        getters: [] as string[], 
        actions: [] as string[] 
      };
      
      // 遍历抽象语法树，提取 Pinia / Vuex 结构
      traverse(ast, {
        ObjectMethod(p: any) {
          const parentKey = p.parentPath?.parent?.key?.name;
          if (parentKey === 'actions') {
            storeInfo.actions.push(p.node.key.name);
          } else if (parentKey === 'getters') {
            storeInfo.getters.push(p.node.key.name);
          }
        },
        ObjectProperty(p: any) {
          const parentKey = p.parentPath?.parent?.key?.name;
          if (parentKey === 'actions' && (p.node.value.type === 'ArrowFunctionExpression' || p.node.value.type === 'FunctionExpression')) {
            storeInfo.actions.push(p.node.key.name);
          } else if (parentKey === 'getters' && (p.node.value.type === 'ArrowFunctionExpression' || p.node.value.type === 'FunctionExpression')) {
            storeInfo.getters.push(p.node.key.name);
          } else if (p.node.key.name === 'state' && p.node.value.type === 'ArrowFunctionExpression') {
             const body = p.node.value.body;
             if (body.type === 'ObjectExpression') {
                 body.properties.forEach((prop: any) => {
                   if (prop.key?.name) storeInfo.state.push(prop.key.name);
                 });
             }
          }
        }
      });
      
      return {
        content: [{ type: "text", text: JSON.stringify(storeInfo, null, 2) }]
      };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    
    return {
      content: [
        {
          type: "text",
          text: `Error processing request: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Local Component MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
