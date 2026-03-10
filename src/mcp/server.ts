import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../tools/index.js';
import { registerResources } from '../resources/index.js';
import { registerPrompts } from '../prompts/index.js';
import type { ApiClient } from '../api/client.js';

/**
 * Factory function that creates and configures a fully-initialized McpServer.
 *
 * Each call creates a fresh server instance, suitable for per-session use.
 * The server is configured with all registered tools, resources, and prompts.
 *
 * @param apiClient - The authenticated API client for making upstream requests.
 * @returns A configured McpServer ready to connect to a transport.
 */
export function createMcpServer(apiClient: ApiClient): McpServer {
  const server = new McpServer(
    {
      name: 'mcp-server-template',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
    },
  );

  // Register all capability handlers
  registerTools(server, apiClient);
  registerResources(server, apiClient);
  registerPrompts(server);

  return server;
}
