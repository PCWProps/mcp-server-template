import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from './mcp/server.js';
import { authMiddleware } from './middleware/auth.js';
import { ApiClient } from './api/client.js';
import type { Env } from './types/env.js';

/**
 * Active sessions: maps sessionId → transport instance.
 *
 * In a stateful single-instance deployment this in-memory map works well.
 * For multi-instance production deployments, migrate session state to
 * Cloudflare Durable Objects or KV.
 */
const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
    exposeHeaders: ['mcp-session-id'],
    maxAge: 600,
  }),
);

// ---------------------------------------------------------------------------
// Health check (unauthenticated)
// ---------------------------------------------------------------------------

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: transports.size,
  });
});

// ---------------------------------------------------------------------------
// MCP endpoint — handles GET (SSE stream), POST (messages), DELETE (close)
// ---------------------------------------------------------------------------

/**
 * GET /mcp — establishes a new SSE session or resumes an existing one.
 * POST /mcp — receives JSON-RPC messages for an existing session.
 * DELETE /mcp — closes a session.
 */
app.all('/mcp', authMiddleware, async (c) => {
  const env = c.env;
  const method = c.req.method;
  const sessionId = c.req.header('mcp-session-id');

  if (method === 'DELETE') {
    if (sessionId) {
      const transport = transports.get(sessionId);
      if (transport) {
        await transport.close();
        transports.delete(sessionId);
      }
    }
    return c.json({ ok: true });
  }

  // For POST requests, route to the existing session's transport
  if (method === 'POST' && sessionId) {
    const transport = transports.get(sessionId);
    if (!transport) {
      return c.json(
        {
          error: 'Session not found. The SSE connection may have been closed.',
          sessionId,
        },
        404,
      );
    }
    return transport.handleRequest(c.req.raw);
  }

  // For GET (new SSE connection) or stateless POST, create a new transport
  const apiClient = new ApiClient(env.TARGET_API_BASE_URL, env.TARGET_API_KEY);
  const mcpServer = createMcpServer(apiClient);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      transports.set(newSessionId, transport);
    },
    onsessionclosed: (closedSessionId) => {
      transports.delete(closedSessionId);
    },
  });

  // Clean up when the connection closes unexpectedly
  c.req.raw.signal.addEventListener('abort', () => {
    if (transport.sessionId) {
      transports.delete(transport.sessionId);
    }
    void transport.close();
  });

  await mcpServer.connect(transport);
  return transport.handleRequest(c.req.raw);
});

// ---------------------------------------------------------------------------
// Legacy SSE compatibility endpoints (for older MCP clients)
// ---------------------------------------------------------------------------

/**
 * GET /sse — legacy SSE endpoint for clients that don't support the
 * newer streamable HTTP transport. Redirects to /mcp.
 *
 * Note: For full legacy support with the old SSEServerTransport protocol,
 * clients should use the /mcp endpoint instead.
 */
app.get('/sse', authMiddleware, (c) => {
  return c.json(
    {
      error: 'This server uses the MCP Streamable HTTP transport.',
      message: 'Please connect to /mcp instead of /sse.',
      mcpEndpoint: '/mcp',
    },
    301,
  );
});

export default app;

