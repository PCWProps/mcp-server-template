import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { registerExampleTool } from './example-tool.js';

/**
 * Registers all MCP tools with the server.
 *
 * Add new tool registrations here as you expand the server's capabilities.
 * Each tool registration function receives the McpServer instance and the
 * ApiClient for making authenticated upstream requests.
 *
 * @param server - The McpServer instance to register tools on.
 * @param client - The authenticated ApiClient for upstream API calls.
 */
export function registerTools(server: McpServer, client: ApiClient): void {
  registerExampleTool(server, client);

  // Add more tool registrations here:
  // registerMyNewTool(server, client);
}

export { registerExampleTool };
