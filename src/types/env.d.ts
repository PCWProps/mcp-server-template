/**
 * Cloudflare Worker environment bindings.
 *
 * These variables are injected at runtime by the Workers runtime.
 * Secrets (TARGET_API_KEY, MCP_AUTH_KEY) should NEVER be committed to source
 * control — set them with `wrangler secret put <NAME>`.
 */
export interface Env {
  /**
   * Base URL for the external API this MCP server wraps.
   * Example: "https://api.example.com"
   * Set in wrangler.toml [vars] or as a secret.
   */
  TARGET_API_BASE_URL: string;

  /**
   * API key / bearer token for authenticating with the target API.
   * Set with: wrangler secret put TARGET_API_KEY
   */
  TARGET_API_KEY: string;

  /**
   * Auth key that MCP clients must present in the Authorization header.
   * Protects the /sse and /message endpoints from unauthorized access.
   * Set with: wrangler secret put MCP_AUTH_KEY
   * Generate with: openssl rand -hex 32
   */
  MCP_AUTH_KEY: string;
}
