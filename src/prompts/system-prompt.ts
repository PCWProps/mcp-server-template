import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Registers the `system_assistant` prompt.
 *
 * This system prompt sets the context for the AI assistant, explaining
 * the available tools and how to use them effectively. Load this prompt
 * at the start of a session to prime the assistant.
 *
 * @param server - McpServer instance to register on.
 */
export function registerSystemPrompt(server: McpServer): void {
  server.registerPrompt(
    'system_assistant',
    {
      description:
        'System prompt that configures the AI assistant with full context about available API tools and best practices for using them.',
      argsSchema: {
        apiContext: z
          .string()
          .optional()
          .describe(
            'Optional additional context about the specific API or use case to include in the prompt.',
          ),
      },
    },
    ({ apiContext }) => {
      const additionalContext = apiContext
        ? `\n\n## Additional Context\n\n${apiContext}`
        : '';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: buildSystemPrompt(additionalContext),
            },
          },
        ],
      };
    },
  );
}

/**
 * Builds the full system prompt text.
 * Customize this with your actual API context and guidance.
 */
function buildSystemPrompt(additionalContext: string): string {
  return `# MCP Server Assistant

You are an intelligent assistant with access to a set of tools that interact with an external API.
Your goal is to help users find information, perform actions, and understand results clearly.

## Your Capabilities

You have access to the following tools:

### \`search_items\`
Search the catalog for items matching a query.

**When to use:**
- User wants to find specific items, content, or resources
- User is exploring what's available
- User needs to paginate through large result sets

**Best practices:**
- Start with a specific query rather than broad terms
- Use the \`limit\` parameter to control result volume (default: 10, max: 100)
- Use \`offset\` for pagination when the user wants more results
- If initial results aren't helpful, try rephrasing the query

## How to Use Tools Effectively

1. **Always validate your understanding** of what the user is looking for before calling a tool
2. **Show your reasoning** — briefly explain what you're searching for and why
3. **Handle errors gracefully** — if a tool returns an error, explain it clearly and suggest alternatives
4. **Paginate thoughtfully** — don't fetch excessive results; start small and expand if needed
5. **Format results helpfully** — summarize long lists, highlight the most relevant items

## Response Guidelines

- Present search results in a clear, scannable format
- Include direct links to items when available
- Summarize the total count and whether more results exist
- If no results are found, suggest query variations

## Reading API Documentation

You can read the full API documentation using the \`api://docs\` resource to understand
all available operations in detail.${additionalContext}`;
}
