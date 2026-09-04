const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const server = new Server({
  name: "my-custom-mcp",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {}
  }
});

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "hello_world",
        description: "Returns a hello world greeting.",
        inputSchema: {
          type: "object",
          properties: {},
        }
      }
    ]
  };
});

// Handle tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "hello_world") {
    return {
      content: [
        {
          type: "text",
          text: "Hello from your new auto-running MCP Server!"
        }
      ]
    };
  }
  throw new Error("Tool not found");
});

// Run server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch(console.error);
