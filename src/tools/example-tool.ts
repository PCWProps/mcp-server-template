import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';

/**
 * Schema for the search_items tool parameters.
 * Zod validates inputs before the tool handler executes.
 */
const SearchItemsSchema = z.object({
  query: z
    .string()
    .min(1, 'Query must not be empty')
    .max(200, 'Query must be 200 characters or fewer')
    .describe('The search query string'),

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum number of results to return (1-100, default: 10)'),

  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Pagination offset (default: 0)'),
});

/** Shape of the API response for the search endpoint */
interface SearchApiResponse {
  items: SearchItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface SearchItem {
  id: string;
  title: string;
  description: string;
  url: string;
  createdAt: string;
  tags: string[];
}

/**
 * Registers the `search_items` tool.
 *
 * This example tool demonstrates the full pattern for an authenticated
 * API call tool, including:
 * - Zod schema validation
 * - Typed API response parsing
 * - Upstream error mapping
 * - Rich markdown-formatted output for the AI
 *
 * @param server - McpServer instance to register on.
 * @param client - Authenticated ApiClient for upstream requests.
 */
export function registerExampleTool(server: McpServer, client: ApiClient): void {
  server.registerTool(
    'search_items',
    {
      description:
        'Search for items in the external API. Returns a paginated list of matching items with titles, descriptions, and URLs.',
      inputSchema: SearchItemsSchema,
    },
    async (params) => {
      let response: SearchApiResponse;

      try {
        response = await client.get<SearchApiResponse>('/search', {
          q: params.query,
          limit: String(params.limit),
          offset: String(params.offset),
        });
      } catch (error) {
        // Map upstream errors to user-friendly MCP error messages
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `❌ **Search failed:** ${message}\n\nPlease try again or refine your query.`,
            },
          ],
        };
      }

      if (response.items.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No results found for **"${params.query}"**.\n\nTry different search terms or check the spelling.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: formatSearchResults(response, params.query, params.offset),
          },
        ],
      };
    },
  );
}

/**
 * Formats search results as markdown for display in the AI response.
 */
function formatSearchResults(
  response: SearchApiResponse,
  query: string,
  offset: number,
): string {
  const start = offset + 1;
  const end = offset + response.items.length;
  const lines: string[] = [
    `## Search Results for "${query}"`,
    ``,
    `Showing ${String(start)}–${String(end)} of ${String(response.total)} results${response.hasMore ? ' (more available)' : ''}`,
    ``,
  ];

  for (const item of response.items) {
    lines.push(`### [${item.title}](${item.url})`);
    lines.push(``);
    lines.push(item.description);
    lines.push(``);

    if (item.tags.length > 0) {
      lines.push(`**Tags:** ${item.tags.map((t) => `\`${t}\``).join(', ')}`);
      lines.push(``);
    }

    lines.push(`*Created: ${new Date(item.createdAt).toLocaleDateString()}*`);
    lines.push(``);
    lines.push('---');
    lines.push(``);
  }

  if (response.hasMore) {
    lines.push(
      `> 💡 Use \`offset: ${String(offset + response.items.length)}\` to fetch the next page.`,
    );
  }

  return lines.join('\n');
}
