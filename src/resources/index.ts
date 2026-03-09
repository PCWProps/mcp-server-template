import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';
import { registerApiDocsResource } from './api-docs.js';

/**
 * Registers all MCP resources with the server.
 *
 * Resources expose read-only data that the AI can fetch. Unlike tools,
 * resources are not called with arguments — the AI requests them by URI.
 *
 * @param server - The McpServer instance to register resources on.
 * @param client - The authenticated ApiClient (if resources need upstream data).
 */
export function registerResources(server: McpServer, _client: ApiClient): void {
  registerApiDocsResource(server);

  // Add more resource registrations here:
  // registerSchemaResource(server);
}

export { registerApiDocsResource };
