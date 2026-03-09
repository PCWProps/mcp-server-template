import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** Base URL used in tests — matches ApiClient default in tests */
export const TEST_BASE_URL = 'https://api.test.example.com';

/** Default test API key */
export const TEST_API_KEY = 'test-api-key-12345';

/**
 * MSW request handlers for common API endpoints used in tests.
 * Individual tests can add/override handlers using `server.use(...)`.
 */
export const handlers = [
  // Default search endpoint handler — returns successful results
  http.get(`${TEST_BASE_URL}/search`, () => {
    return HttpResponse.json({
      items: [
        {
          id: 'item_001',
          title: 'Test Item One',
          description: 'Description for test item one.',
          url: 'https://example.com/items/item_001',
          createdAt: '2024-01-15T10:30:00Z',
          tags: ['test', 'example'],
        },
        {
          id: 'item_002',
          title: 'Test Item Two',
          description: 'Description for test item two.',
          url: 'https://example.com/items/item_002',
          createdAt: '2024-02-20T14:00:00Z',
          tags: ['demo'],
        },
      ],
      total: 2,
      page: 1,
      hasMore: false,
    });
  }),
];

/**
 * MSW server instance for intercepting HTTP requests in tests.
 *
 * Import and use `server` in your test files:
 * ```typescript
 * import { server } from './setup.js';
 * ```
 */
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset any runtime handlers between tests
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
