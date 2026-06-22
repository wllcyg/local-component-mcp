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
