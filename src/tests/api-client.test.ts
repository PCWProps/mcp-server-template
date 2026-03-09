import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ApiClient, ApiError } from '../api/client.js';
import { server, TEST_BASE_URL, TEST_API_KEY } from './setup.js';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient(TEST_BASE_URL, TEST_API_KEY);
  });

  // ---------------------------------------------------------------------------
  // GET requests
  // ---------------------------------------------------------------------------

  describe('get()', () => {
    it('returns parsed JSON on a successful 200 response', async () => {
      const result = await client.get<{ items: unknown[] }>('/search', { q: 'test' });

      expect(result).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'item_001', title: 'Test Item One' }),
          expect.objectContaining({ id: 'item_002', title: 'Test Item Two' }),
        ]),
        total: 2,
        hasMore: false,
      });
    });

    it('includes Authorization header with Bearer token', async () => {
      let capturedAuthHeader: string | null = null;

      server.use(
        http.get(`${TEST_BASE_URL}/auth-check`, ({ request }) => {
          capturedAuthHeader = request.headers.get('Authorization');
          return HttpResponse.json({ ok: true });
        }),
      );

      await client.get('/auth-check');

      expect(capturedAuthHeader).toBe(`Bearer ${TEST_API_KEY}`);
    });

    it('appends query parameters to the URL', async () => {
      let capturedUrl: string | null = null;

      server.use(
        http.get(`${TEST_BASE_URL}/search`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ items: [], total: 0, page: 1, hasMore: false });
        }),
      );

      await client.get('/search', { q: 'hello world', limit: '5' });

      expect(capturedUrl).toContain('q=hello+world');
      expect(capturedUrl).toContain('limit=5');
    });

    it('throws ApiError with status 404 for not-found responses', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/missing`, () => {
          return HttpResponse.json({ message: 'Resource not found' }, { status: 404 });
        }),
      );

      await expect(client.get('/missing')).rejects.toThrow(ApiError);
      await expect(client.get('/missing')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Resource not found'),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // POST requests
  // ---------------------------------------------------------------------------

  describe('post()', () => {
    it('sends a JSON body and returns the response', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/items`, async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({ created: true, received: body }, { status: 201 });
        }),
      );

      const result = await client.post<{ created: boolean }>('/items', {
        name: 'New Item',
        tags: ['a', 'b'],
      });

      expect(result).toMatchObject({ created: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Retry behavior
  // ---------------------------------------------------------------------------

  describe('retry logic', () => {
    it('retries on HTTP 429 and succeeds on subsequent attempt', async () => {
      let callCount = 0;

      server.use(
        http.get(`${TEST_BASE_URL}/retry-test`, () => {
          callCount++;
          if (callCount < 2) {
            return HttpResponse.json({ error: 'Rate limited' }, { status: 429 });
          }
          return HttpResponse.json({ success: true });
        }),
      );

      const result = await client.get<{ success: boolean }>('/retry-test', undefined, {
        maxRetries: 3,
      });

      expect(result).toMatchObject({ success: true });
      expect(callCount).toBe(2);
    });

    it('retries on HTTP 500 and succeeds on subsequent attempt', async () => {
      let callCount = 0;

      server.use(
        http.get(`${TEST_BASE_URL}/server-error`, () => {
          callCount++;
          if (callCount < 2) {
            return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
          }
          return HttpResponse.json({ data: 'ok' });
        }),
      );

      const result = await client.get<{ data: string }>('/server-error', undefined, {
        maxRetries: 3,
      });

      expect(result).toMatchObject({ data: 'ok' });
      expect(callCount).toBe(2);
    });

    it('throws ApiError after exhausting all retries', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/always-fails`, () => {
          return HttpResponse.json({ error: 'Always fails' }, { status: 500 });
        }),
      );

      await expect(
        client.get('/always-fails', undefined, { maxRetries: 2 }),
      ).rejects.toThrow(ApiError);
    });
  });

  // ---------------------------------------------------------------------------
  // Timeout handling
  // ---------------------------------------------------------------------------

  describe('timeout handling', () => {
    it('throws a timeout error when the request exceeds the timeout', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/slow`, async () => {
          // Simulate a slow response by never resolving within the test timeout
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return HttpResponse.json({ data: 'too late' });
        }),
      );

      await expect(
        client.get('/slow', undefined, { timeoutMs: 100, maxRetries: 1 }),
      ).rejects.toThrow(/timed out/i);
    });
  });

  // ---------------------------------------------------------------------------
  // HTML error page handling
  // ---------------------------------------------------------------------------

  describe('HTML error page handling', () => {
    it('throws a descriptive error when the API returns an HTML error page', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/html-error`, () => {
          return new HttpResponse('<html><body><h1>503 Service Unavailable</h1></body></html>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
          });
        }),
      );

      await expect(
        client.get('/html-error', undefined, { maxRetries: 1 }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('HTML error page'),
        statusCode: 503,
      });
    });
  });
});
