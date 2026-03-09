# Contributing to MCP Server Template

Thank you for your interest in contributing! This document explains how to set up the project locally, understand the architecture, add new MCP capabilities, and get your changes merged.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Fork and Clone](#fork-and-clone)
  - [Local Setup](#local-setup)
- [Architecture Overview](#architecture-overview)
- [Adding MCP Capabilities](#adding-mcp-capabilities)
  - [Adding a New Tool](#adding-a-new-tool)
  - [Adding a New Resource](#adding-a-new-resource)
  - [Adding a New Prompt](#adding-a-new-prompt)
- [Using the OpenAPI Ingestion Script](#using-the-openapi-ingestion-script)
- [Branching Strategy](#branching-strategy)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 18.x | [nodejs.org](https://nodejs.org) |
| pnpm | >= 8.x | `npm install -g pnpm` |
| Wrangler CLI | >= 3.x | `pnpm add -g wrangler` |
| Git | >= 2.x | [git-scm.com](https://git-scm.com) |

### Fork and Clone

1. **Fork** the repository on GitHub by clicking the Fork button.
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/<your-username>/mcp-server-template.git
   cd mcp-server-template
   ```

3. **Add the upstream remote** to keep your fork up to date:

   ```bash
   git remote add upstream https://github.com/PCWProps/mcp-server-template.git
   ```

### Local Setup

1. **Install dependencies** using pnpm:

   ```bash
   pnpm install
   ```

2. **Copy the example environment file** and fill in your values:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

   Edit `.dev.vars`:

   ```ini
   TARGET_API_BASE_URL=https://api.example.com
   TARGET_API_KEY=your-api-key-here
   MCP_AUTH_KEY=your-mcp-auth-key-here
   ```

3. **Start the local development server** using Wrangler:

   ```bash
   pnpm dev
   # or: wrangler dev
   ```

   This starts a local Cloudflare Workers runtime at `http://localhost:8787`.

4. **Verify the server is running:**

   ```bash
   curl http://localhost:8787/health
   # Expected: {"status":"ok","timestamp":"..."}
   ```

5. **Run the test suite:**

   ```bash
   pnpm test
   ```

---

## Architecture Overview

```
mcp-server-template/
├── src/
│   ├── index.ts              # Hono app entry point, SSE + message routing
│   ├── mcp/
│   │   └── server.ts         # McpServer factory, capability registration
│   ├── tools/
│   │   ├── index.ts          # Tool registry + registerTools()
│   │   └── example-tool.ts   # Example tool implementation
│   ├── resources/
│   │   ├── index.ts          # Resource registry + registerResources()
│   │   └── api-docs.ts       # Example resource
│   ├── prompts/
│   │   ├── index.ts          # Prompt registry + registerPrompts()
│   │   └── system-prompt.ts  # Example prompt
│   ├── api/
│   │   └── client.ts         # Type-safe fetch wrapper with retry
│   ├── middleware/
│   │   └── auth.ts           # Bearer token auth middleware
│   ├── types/
│   │   └── env.d.ts          # Cloudflare Worker env bindings
│   └── tests/
│       ├── setup.ts           # MSW server setup
│       ├── api-client.test.ts # API client unit tests
│       └── tools.test.ts      # Tool unit tests
├── scripts/
│   └── ingest-openapi.ts     # OpenAPI → MCP tool generator
├── wrangler.toml             # Cloudflare Workers config
├── tsconfig.json             # TypeScript config
├── vitest.config.ts          # Test config
└── package.json
```

**Request Flow:**

```
MCP Client (Claude / Cursor)
  │
  ├── GET /sse        → creates SSEServerTransport → connects McpServer
  │                     (long-lived SSE connection)
  │
  └── POST /message   → routes to correct transport by sessionId
                        McpServer processes tool/resource/prompt calls
                           │
                           └── ApiClient → External REST API
```

---

## Adding MCP Capabilities

### Adding a New Tool

Tools are functions the AI can call. They live in `src/tools/`.

1. **Create the tool file** `src/tools/my-tool.ts`:

   ```typescript
   import { z } from 'zod';
   import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
   import type { ApiClient } from '../api/client.js';

   const MyToolSchema = z.object({
     query: z.string().min(1).describe('The search query'),
     limit: z.number().int().min(1).max(100).default(10).describe('Max results'),
   });

   export function registerMyTool(server: McpServer, client: ApiClient): void {
     server.tool(
       'my_tool_name',
       'Description of what this tool does for the AI',
       MyToolSchema.shape,
       async (params) => {
         const result = await client.get<MyResponseType>('/endpoint', {
           params: { q: params.query, limit: params.limit },
         });

         return {
           content: [
             {
               type: 'text',
               text: formatResult(result),
             },
           ],
         };
       },
     );
   }

   function formatResult(result: MyResponseType): string {
     // Format result as markdown for the AI
     return `## Results\n\n${result.items.map((i) => `- ${i.name}`).join('\n')}`;
   }
   ```

2. **Register the tool** in `src/tools/index.ts`:

   ```typescript
   import { registerMyTool } from './my-tool.js';

   export function registerTools(server: McpServer, client: ApiClient): void {
     registerExampleTool(server, client);
     registerMyTool(server, client);  // Add this line
   }
   ```

3. **Add tests** in `src/tests/tools.test.ts` (see existing tests for patterns).

4. **Run the tests:**

   ```bash
   pnpm test
   pnpm typecheck
   ```

### Adding a New Resource

Resources expose data the AI can read. They live in `src/resources/`.

1. **Create the resource file** `src/resources/my-resource.ts`:

   ```typescript
   import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

   export function registerMyResource(server: McpServer): void {
     server.resource(
       'my-resource',
       'my-resource://data',
       async (uri) => ({
         contents: [
           {
             uri: uri.href,
             mimeType: 'text/plain',
             text: 'Resource content here',
           },
         ],
       }),
     );
   }
   ```

2. **Register** it in `src/resources/index.ts`.

### Adding a New Prompt

Prompts are reusable message templates. They live in `src/prompts/`.

1. **Create the prompt file** `src/prompts/my-prompt.ts`:

   ```typescript
   import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

   export function registerMyPrompt(server: McpServer): void {
     server.prompt(
       'my_prompt',
       'Description of this prompt template',
       { topic: z.string().describe('The topic to focus on') },
       async ({ topic }) => ({
         messages: [
           {
             role: 'user',
             content: {
               type: 'text',
               text: `You are an expert in ${topic}. Help the user with...`,
             },
           },
         ],
       }),
     );
   }
   ```

2. **Register** it in `src/prompts/index.ts`.

---

## Using the OpenAPI Ingestion Script

If the target API has an OpenAPI 3.x spec, you can auto-generate tool skeletons:

```bash
# Place your openapi.json in the project root
cp /path/to/your/openapi.json ./openapi.json

# Run the ingestion script
pnpm tsx scripts/ingest-openapi.ts

# Review generated files in src/tools/
# Then customize as needed and register in src/tools/index.ts
```

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code, deploys automatically |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation only |
| `chore/*` | Maintenance, deps, tooling |
| `refactor/*` | Code restructuring (no behavior change) |

**Workflow:**

```bash
# Sync your fork with upstream
git fetch upstream
git rebase upstream/main

# Create a feature branch
git checkout -b feat/my-new-tool

# Make changes, commit, push
git push origin feat/my-new-tool

# Open a Pull Request on GitHub
```

---

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**Examples:**

```
feat(tools): add search_repositories tool for GitHub API
fix(auth): use timing-safe comparison for MCP_AUTH_KEY
docs: update README with new quickstart steps
chore(deps): bump wrangler to 3.40.0
```

---

## Pull Request Process

1. Ensure `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass locally.
2. Add a changeset for user-facing changes: `pnpm changeset`.
3. Open a Pull Request against the `main` branch.
4. Fill out the PR template completely.
5. Request review from `@PCWProps` or another maintainer.
6. Address any review feedback.
7. A maintainer will merge the PR once approved and CI passes.

---

## Release Process

Releases are automated via [Changesets](https://github.com/changesets/changesets):

1. Contributors add changesets with `pnpm changeset` when making user-facing changes.
2. The CI `release.yml` workflow opens a "Version Packages" PR when changesets accumulate.
3. Merging the version PR triggers an automatic GitHub Release and CHANGELOG update.

---

## Getting Help

- 💬 **GitHub Discussions** — for questions and ideas
- 🐛 **GitHub Issues** — for bugs and feature requests
- 📧 **Email** — see [SECURITY.md](SECURITY.md) for security issues
