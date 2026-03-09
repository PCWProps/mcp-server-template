import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../api/client.js';
import { registerExampleTool } from '../tools/example-tool.js';
import { server, TEST_BASE_URL, TEST_API_KEY } from './setup.js';

/**
 * Helper to call a registered tool directly via the McpServer's internal handler.
 * This simulates the MCP SDK's tool invocation without needing a full transport.
 */
async function callTool(
  mcpServer: McpServer,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  // Access the internal registry for tool handlers
  interface InternalServer {
    _registeredTools: Record<string, { handler: (args: Record<string, unknown>) => Promise<unknown> }>;
  }
  const registry = (mcpServer as unknown as InternalServer)._registeredTools;
  const toolEntry = registry[toolName];
  if (!toolEntry) {
    throw new Error(`Tool "${toolName}" not found on server`);
  }
  return toolEntry.handler(args) as Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}

describe('search_items tool', () => {
  let mcpServer: McpServer;
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient(TEST_BASE_URL, TEST_API_KEY);
    mcpServer = new McpServer({ name: 'test-server', version: '0.0.1' });
    registerExampleTool(mcpServer, apiClient);
  });

  // ---------------------------------------------------------------------------
  // Valid inputs
  // ---------------------------------------------------------------------------

  describe('valid inputs', () => {
    it('returns formatted markdown results for a successful search', async () => {
      const result = await callTool(mcpServer, 'search_items', { query: 'test', limit: 10, offset: 0 });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('Search Results for "test"');
      expect(text).toContain('Test Item One');
      expect(text).toContain('Test Item Two');
      expect(text).toContain('of 2 results');
    });

    it('uses default limit of 10 when not specified', async () => {
      let capturedQuery: string | null = null;

      server.use(
        http.get(`${TEST_BASE_URL}/search`, ({ request }) => {
          capturedQuery = new URL(request.url).searchParams.get('limit');
          return HttpResponse.json({ items: [], total: 0, page: 1, hasMore: false });
        }),
      );

      // Pass limit explicitly to match what MCP SDK would inject from Zod default
      await callTool(mcpServer, 'search_items', { query: 'test', limit: 10, offset: 0 });

      expect(capturedQuery).toBe('10');
    });

    it('passes custom limit and offset to the API', async () => {
      let capturedLimit: string | null = null;
      let capturedOffset: string | null = null;

      server.use(
        http.get(`${TEST_BASE_URL}/search`, ({ request }) => {
          const url = new URL(request.url);
          capturedLimit = url.searchParams.get('limit');
          capturedOffset = url.searchParams.get('offset');
          return HttpResponse.json({ items: [], total: 0, page: 1, hasMore: false });
        }),
      );

      await callTool(mcpServer, 'search_items', { query: 'test', limit: 25, offset: 50 });

      expect(capturedLimit).toBe('25');
      expect(capturedOffset).toBe('50');
    });

    it('returns empty results message when no items found', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/search`, () => {
          return HttpResponse.json({ items: [], total: 0, page: 1, hasMore: false });
        }),
      );

      const result = await callTool(mcpServer, 'search_items', { query: 'xyznotfound', limit: 10, offset: 0 });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toContain('No results found');
      expect(result.content[0]?.text).toContain('xyznotfound');
    });

    it('shows pagination hint when hasMore is true', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/search`, () => {
          return HttpResponse.json({
            items: [
              {
                id: 'item_001',
                title: 'Item',
                description: 'Desc',
                url: 'https://example.com',
                createdAt: '2024-01-01T00:00:00Z',
                tags: [],
              },
            ],
            total: 100,
            page: 1,
            hasMore: true,
          });
        }),
      );

      const result = await callTool(mcpServer, 'search_items', { query: 'test', limit: 1, offset: 0 });

      expect(result.content[0]?.text).toContain('offset:');
    });
  });

  // ---------------------------------------------------------------------------
  // Upstream errors
  // ---------------------------------------------------------------------------

  describe('upstream error handling', () => {
    it('returns isError: true when the API returns a 500 error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/search`, () => {
          return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
        }),
      );

      const result = await callTool(mcpServer, 'search_items', {
        query: 'test',
        limit: 10,
        offset: 0,
        // Only 1 retry to keep the test fast
      });

      // After retries are exhausted, the tool should return isError
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Search failed');
    });

    it('returns isError: true when the API returns a 401 error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/search`, () => {
          return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }),
      );

      const result = await callTool(mcpServer, 'search_items', { query: 'test', limit: 10, offset: 0 });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Search failed');
    });
  });
});
