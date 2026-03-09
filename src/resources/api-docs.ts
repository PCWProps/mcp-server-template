import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** URI scheme for API documentation resources */
const API_DOCS_URI = 'api://docs';

/**
 * Registers the `api://docs` resource.
 *
 * This resource exposes the external API's documentation as a text resource
 * that the AI can read to understand how to use the available tools correctly.
 *
 * Customize the content below with your actual API documentation.
 *
 * @param server - McpServer instance to register on.
 */
export function registerApiDocsResource(server: McpServer): void {
  server.registerResource(
    'api-docs',
    API_DOCS_URI,
    {
      description:
        'API documentation for the external service. Read this to understand the available operations, parameters, and response formats.',
      mimeType: 'text/markdown',
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: API_DOCUMENTATION,
        },
      ],
    }),
  );
}

/**
 * Documentation content for the external API.
 * Replace this with your actual API documentation.
 */
const API_DOCUMENTATION = `# External API Documentation

## Overview

This API provides access to a searchable catalog of items. All requests require
authentication via a Bearer token.

## Base URL

\`\`\`
https://api.example.com
\`\`\`

## Authentication

All requests must include the \`Authorization\` header:

\`\`\`
Authorization: Bearer <YOUR_API_KEY>
\`\`\`

## Endpoints

### Search Items

\`GET /search\`

Search the catalog for items matching a query.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| \`q\` | string | ✅ | — | Search query (max 200 chars) |
| \`limit\` | integer | ❌ | 10 | Results per page (1-100) |
| \`offset\` | integer | ❌ | 0 | Pagination offset |

**Response:**

\`\`\`json
{
  "items": [
    {
      "id": "item_abc123",
      "title": "Example Item",
      "description": "A detailed description of the item.",
      "url": "https://api.example.com/items/item_abc123",
      "createdAt": "2024-01-15T10:30:00Z",
      "tags": ["example", "demo"]
    }
  ],
  "total": 42,
  "page": 1,
  "hasMore": true
}
\`\`\`

**Error Responses:**

| Status | Meaning |
|--------|---------|
| 400 | Bad request — invalid parameters |
| 401 | Unauthorized — invalid or missing API key |
| 429 | Rate limited — slow down requests |
| 500 | Server error — retry with backoff |

## Rate Limits

- 100 requests per minute per API key
- Exponential backoff is applied automatically by the MCP server

## Available MCP Tools

The following tools wrap this API:

- **\`search_items\`** — Search for items by query string with pagination support
`;
