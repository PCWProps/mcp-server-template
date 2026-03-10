import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSystemPrompt } from './system-prompt.js';

/**
 * Registers all MCP prompts with the server.
 *
 * Prompts are reusable message templates that the AI can load into context.
 * They help shape how the AI behaves when using this server's tools.
 *
 * @param server - The McpServer instance to register prompts on.
 */
export function registerPrompts(server: McpServer): void {
  registerSystemPrompt(server);

  // Add more prompt registrations here:
  // registerSearchGuidePrompt(server);
}

export { registerSystemPrompt };
