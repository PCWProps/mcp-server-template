import { createMiddleware } from 'hono/factory';
import type { Env } from '../types/env.js';

/**
 * Timing-safe string comparison to prevent timing attacks.
 *
 * Uses a constant-time comparison algorithm that avoids leaking information
 * about how many characters match via response time differences.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);

  // Lengths must match for equality — but we still compare all bytes
  // to avoid short-circuit timing differences
  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    // XOR: if bytes differ, result becomes non-zero
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return result === 0;
}

/**
 * Hono middleware that enforces Bearer token authentication.
 *
 * Clients must include an `Authorization: Bearer <MCP_AUTH_KEY>` header.
 * The comparison uses a timing-safe algorithm to prevent timing attacks.
 *
 * On failure, returns HTTP 401 with a JSON error body.
 *
 * @example
 * ```typescript
 * app.get('/sse', authMiddleware, async (c) => { ... });
 * ```
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing Authorization header. Expected: Authorization: Bearer <token>',
      },
      401,
    );
  }

  if (!authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid Authorization format. Expected: Authorization: Bearer <token>',
      },
      401,
    );
  }

  const providedKey = authHeader.slice('Bearer '.length);
  const expectedKey = c.env.MCP_AUTH_KEY;

  if (!expectedKey) {
    // MCP_AUTH_KEY is not configured — fail closed (deny all)
    console.error('MCP_AUTH_KEY environment variable is not set. Denying all requests.');
    return c.json(
      {
        error: 'Service Unavailable',
        message: 'Authentication is not properly configured. Contact the server administrator.',
      },
      503,
    );
  }

  if (!timingSafeEqual(providedKey, expectedKey)) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid API key.',
      },
      401,
    );
  }

  await next();
  return;
});
