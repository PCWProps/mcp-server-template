# Security Policy

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability in this project, please report it privately to maintain responsible disclosure. We take all security reports seriously and will respond promptly.

### How to Report

**Option 1: GitHub Private Security Advisory (Preferred)**

Use GitHub's built-in private vulnerability reporting:

1. Navigate to the [Security tab](../../security) of this repository.
2. Click **"Report a vulnerability"**.
3. Fill out the advisory form with as much detail as possible.

**Option 2: Email**

Send an encrypted email to: **[INSERT MAINTAINER SECURITY EMAIL]**

PGP Key Fingerprint: `[INSERT PGP FINGERPRINT]`

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
[INSERT PGP PUBLIC KEY HERE]
-----END PGP PUBLIC KEY BLOCK-----
```

### What to Include

Please include the following in your report:

- **Type of vulnerability** (e.g., authentication bypass, injection, information disclosure)
- **Affected component** (e.g., `src/middleware/auth.ts`, `src/api/client.ts`)
- **Steps to reproduce** the vulnerability
- **Potential impact** if exploited
- **Any suggested mitigations** you have identified
- **Your contact information** for follow-up questions

---

## Supported Versions

We provide security updates for the following versions:

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ Active support |
| Previous minor | ✅ Security fixes only |
| Older versions | ❌ No longer supported |

We strongly recommend always using the latest version of this template.

---

## Response SLAs

| Stage | Timeline |
|-------|----------|
| **Acknowledgement** | Within **24 hours** of receiving your report |
| **Initial assessment** | Within **72 hours** — we will confirm severity and scope |
| **Fix development** | Within **7 days** for critical/high severity issues |
| **Patch release** | Within **14 days** for critical/high severity issues |
| **Public disclosure** | Coordinated with reporter, typically after patch is deployed |

We follow [responsible disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure) principles. We will work with you to coordinate public disclosure after a fix is available.

---

## Security Best Practices for Users

When deploying this template, please follow these security recommendations:

### Secrets Management

- **Never** commit secrets to source control.
- Use Cloudflare Workers Secrets for `TARGET_API_KEY` and `MCP_AUTH_KEY`:

  ```bash
  wrangler secret put TARGET_API_KEY
  wrangler secret put MCP_AUTH_KEY
  ```

- Rotate the `MCP_AUTH_KEY` periodically.

### Authentication

- Always set a strong `MCP_AUTH_KEY` — use a cryptographically random value of at least 32 bytes:

  ```bash
  openssl rand -hex 32
  ```

- The auth middleware uses timing-safe comparison to prevent timing attacks.

### Network Security

- The `TARGET_API_KEY` is only used server-side in the Worker; it is never exposed to clients.
- All outbound requests from the Worker use HTTPS.

### Dependency Security

- Dependencies are monitored by Dependabot (see `.github/workflows/dependabot.yml`).
- Run `pnpm audit` regularly to check for known vulnerabilities.

---

## Scope

This security policy covers the source code in this repository. It does not cover:

- Third-party dependencies (report those to their respective projects)
- Vulnerabilities in Cloudflare Workers infrastructure (report to [Cloudflare](https://www.cloudflare.com/trust-hub/vulnerability-disclosure-policy/))
- The MCP SDK itself (report to [Anthropic's MCP repo](https://github.com/modelcontextprotocol/sdk))

---

## Hall of Fame

We appreciate responsible disclosure from the security community. With your permission, we will acknowledge your contribution here.

*No reports yet — be the first!*
