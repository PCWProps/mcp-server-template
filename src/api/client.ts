/** Maximum number of retry attempts for failed requests */
const MAX_RETRIES = 3;

/** Base delay (ms) for exponential backoff */
const BASE_RETRY_DELAY_MS = 500;

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30_000;

/** HTTP status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Options for API requests.
 */
export interface RequestOptions {
  /** Request timeout override in milliseconds (default: 30s) */
  timeoutMs?: number;
  /** Additional headers to merge with defaults */
  headers?: Record<string, string>;
  /** Number of retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * A type-safe, production-ready HTTP client for the external API.
 *
 * Features:
 * - Automatic Bearer token injection
 * - 30-second request timeout via AbortController
 * - Exponential backoff retry on 429 / 5xx responses (up to 3 attempts)
 * - Graceful handling of HTML error pages (converts to meaningful errors)
 * - Fully typed request/response via generics
 *
 * @example
 * ```typescript
 * const client = new ApiClient('https://api.example.com', process.env.API_KEY);
 * const results = await client.get<SearchResponse>('/search', { q: 'query' });
 * ```
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  /**
   * @param baseUrl - Base URL of the API, e.g. "https://api.example.com"
   * @param apiKey  - API key / Bearer token for authentication
   */
  constructor(baseUrl: string, apiKey: string) {
    // Normalize: strip trailing slash from base URL
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  /**
   * Perform a typed GET request.
   *
   * @param path       - API path, e.g. "/search"
   * @param queryParams - Query string parameters as a key/value record
   * @param options    - Optional request overrides
   * @returns Parsed JSON response typed as T
   */
  async get<T>(
    path: string,
    queryParams?: Record<string, string>,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, queryParams);
    return this.request<T>('GET', url, undefined, options);
  }

  /**
   * Perform a typed POST request.
   *
   * @param path    - API path
   * @param body    - Request body (will be JSON-serialized)
   * @param options - Optional request overrides
   * @returns Parsed JSON response typed as T
   */
  async post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>('POST', url, body, options);
  }

  /**
   * Core request method with timeout, retry, and error handling.
   *
   * @param method  - HTTP method
   * @param url     - Full URL to request
   * @param body    - Optional request body
   * @param options - Optional request overrides
   */
  private async request<T>(
    method: string,
    url: URL,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const maxRetries = options?.maxRetries ?? MAX_RETRIES;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const requestHeaders: Record<string, string> = {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options?.headers,
        };

        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body !== undefined && method !== 'GET') {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), fetchOptions);

        // Check if we should retry this response
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxRetries - 1) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const delay = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : BASE_RETRY_DELAY_MS * Math.pow(2, attempt);

          lastError = new ApiError(
            `Server responded with ${String(response.status)}. Retrying in ${String(delay)}ms... (attempt ${String(attempt + 1)}/${String(maxRetries)})`,
            response.status,
          );

          await sleep(delay);
          continue;
        }

        // Parse the response
        return await this.parseResponse<T>(response);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ApiError(`Request timed out after ${String(timeoutMs)}ms`, 408);
        }

        // Non-retryable error (network failure, etc.)
        if (attempt === maxRetries - 1) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // All retries exhausted
    throw lastError ?? new Error('Request failed after all retry attempts');
  }

  /**
   * Parses an HTTP Response, handling both JSON and HTML error pages.
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('Content-Type') ?? '';

    if (!response.ok) {
      // Handle HTML error pages (common with CDNs, proxies, and WAFs)
      if (contentType.includes('text/html')) {
        throw new ApiError(
          `API returned an HTML error page (HTTP ${String(response.status)}). ` +
            `This may indicate a network issue, maintenance window, or misconfigured base URL.`,
          response.status,
        );
      }

      // Attempt to parse JSON error response
      let errorMessage = `HTTP ${String(response.status)}: ${response.statusText}`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        const errorBody: Record<string, unknown> = await response.json() as any;
        const apiMessage =
          typeof errorBody.message === 'string'
            ? errorBody.message
            : typeof errorBody.error === 'string'
              ? errorBody.error
              : JSON.stringify(errorBody);
        errorMessage = `HTTP ${String(response.status)}: ${apiMessage}`;
      } catch {
        // If JSON parsing fails, use the status text
      }

      throw new ApiError(errorMessage, response.status);
    }

    // Success response
    if (contentType.includes('application/json')) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
      return response.json() as any;
    }

    // Treat non-JSON responses as text (cast for caller to handle)
    const text = await response.text();
    return text as unknown as T;
  }

  /** Build a URL from a path and optional query parameters */
  private buildUrl(path: string, queryParams?: Record<string, string>): URL {
    const url = new URL(`${this.baseUrl}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }
    return url;
  }
}

/**
 * Typed API error with HTTP status code.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Async sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
