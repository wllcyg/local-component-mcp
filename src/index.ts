#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Tool schemas
import { toolSchemas } from "./tools/schemas.js";

// Tool handlers
import { handleSearchComponents, handleGetComponentDetail } from "./tools/components.js";
import { handleSearchStores, handleGetStoreDetail } from "./tools/stores.js";
import { handleGetComponentUsages } from "./tools/usages.js";

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

// Register tool list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolSchemas };
});

// Dispatch tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_components":
        return await handleSearchComponents(args);

      case "get_component_detail":
        return await handleGetComponentDetail(args);

      case "get_component_usages":
        return await handleGetComponentUsages(args);

      case "search_stores":
        return await handleSearchStores(args);

      case "get_store_detail":
        return await handleGetStoreDetail(args);

      default:
        throw new McpError(-32601, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (error instanceof McpError) throw error;
    return {
      content: [{ type: "text", text: `Error processing request: ${error.message}` }],
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
