#!/usr/bin/env tsx
/**
 * OpenAPI → MCP Tool Generator
 *
 * This script reads an OpenAPI 3.x specification from `openapi.json` in the
 * project root and generates MCP tool skeleton files in `src/tools/`.
 *
 * For each path/operation in the spec, it:
 *   1. Parses operationId, parameters, and requestBody
 *   2. Generates a Zod schema for the tool parameters
 *   3. Generates a complete tool skeleton TypeScript file
 *   4. Outputs a summary of all generated files
 *
 * Usage:
 *   pnpm ingest-openapi
 *   # or: pnpm tsx scripts/ingest-openapi.ts [--spec path/to/openapi.json]
 *
 * After generation:
 *   1. Review the generated files in src/tools/
 *   2. Implement the API call logic inside each tool
 *   3. Register the new tools in src/tools/index.ts
 *
 * @module ingest-openapi
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(PROJECT_ROOT, 'src', 'tools');

// ---------------------------------------------------------------------------
// OpenAPI 3.x Type Definitions
// ---------------------------------------------------------------------------

interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseObject>;
  tags?: string[];
}

interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

interface RequestBody {
  required?: boolean;
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  $ref?: string;
}

// ---------------------------------------------------------------------------
// Core Generator Logic
// ---------------------------------------------------------------------------

/**
 * Represents a single processed operation ready for code generation.
 */
interface ProcessedOperation {
  /** Original path (e.g. "/search/items") */
  path: string;
  /** HTTP method in uppercase (e.g. "GET") */
  method: string;
  /** Sanitized tool name in snake_case (e.g. "search_items") */
  toolName: string;
  /** camelCase function name (e.g. "searchItems") */
  functionName: string;
  /** Human-readable description for the tool */
  description: string;
  /** All parameters for this operation */
  parameters: ProcessedParameter[];
  /** Whether this operation has a request body */
  hasRequestBody: boolean;
  /** Original operation ID */
  operationId: string;
}

interface ProcessedParameter {
  name: string;
  zodType: string;
  required: boolean;
  description: string;
  location: 'query' | 'path' | 'header' | 'cookie' | 'body';
}

/**
 * Reads and parses the OpenAPI spec file.
 *
 * @param specPath - Absolute path to the openapi.json file
 * @returns Parsed OpenAPI spec object
 * @throws If the file doesn't exist or contains invalid JSON
 */
function readOpenApiSpec(specPath: string): OpenApiSpec {
  if (!fs.existsSync(specPath)) {
    throw new Error(
      `OpenAPI spec not found at: ${specPath}\n` +
        `Please copy your openapi.json to the project root:\n` +
        `  cp /path/to/openapi.json ${specPath}`,
    );
  }

  const raw = fs.readFileSync(specPath, 'utf-8');
  let spec: unknown;

  try {
    spec = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${specPath}: ${String(err)}`);
  }

  const openApiSpec = spec as Partial<OpenApiSpec>;

  if (!openApiSpec.openapi || !openApiSpec.paths) {
    throw new Error(
      `Invalid OpenAPI spec: missing required fields "openapi" or "paths".\n` +
        `Supported versions: OpenAPI 3.0.x and 3.1.x`,
    );
  }

  return openApiSpec as OpenApiSpec;
}

/**
 * Converts an OpenAPI schema type to the appropriate Zod schema builder call.
 *
 * @param schema - OpenAPI SchemaObject
 * @param required - Whether this field is required
 * @returns Zod schema string (e.g. 'z.string().min(1).describe("...")')
 */
function schemaToZod(schema: SchemaObject | undefined, required: boolean): string {
  if (!schema) return required ? 'z.unknown()' : 'z.unknown().optional()';

  let zodStr: string;

  switch (schema.type) {
    case 'string': {
      let s = 'z.string()';
      if (schema.minLength !== undefined) s += `.min(${String(schema.minLength)})`;
      if (schema.maxLength !== undefined) s += `.max(${String(schema.maxLength)})`;
      if (schema.enum) {
        const enumValues = schema.enum.map((v) => JSON.stringify(v)).join(', ');
        s = `z.enum([${enumValues}])`;
      }
      zodStr = s;
      break;
    }
    case 'integer':
    case 'number': {
      let n = 'z.number()';
      if (schema.type === 'integer') n += '.int()';
      if (schema.minimum !== undefined) n += `.min(${String(schema.minimum)})`;
      if (schema.maximum !== undefined) n += `.max(${String(schema.maximum)})`;
      zodStr = n;
      break;
    }
    case 'boolean':
      zodStr = 'z.boolean()';
      break;
    case 'array': {
      const itemZod = schemaToZod(schema.items, true);
      zodStr = `z.array(${itemZod})`;
      break;
    }
    case 'object':
      zodStr = 'z.record(z.unknown())';
      break;
    default:
      zodStr = 'z.unknown()';
  }

  if (schema.default !== undefined) {
    zodStr += `.default(${JSON.stringify(schema.default)})`;
  }

  if (!required) {
    zodStr += '.optional()';
  }

  if (schema.description) {
    const escapedDesc = schema.description.replace(/"/g, '\\"').replace(/\n/g, ' ');
    zodStr += `.describe("${escapedDesc}")`;
  }

  return zodStr;
}

/**
 * Converts an operationId or path+method combo to a snake_case tool name.
 *
 * @param operationId - The OpenAPI operationId (may be camelCase or PascalCase)
 * @param httpMethod  - HTTP method as fallback
 * @param apiPath     - API path as additional fallback
 * @returns snake_case tool name
 */
function toToolName(operationId: string | undefined, httpMethod: string, apiPath: string): string {
  if (operationId) {
    // Convert camelCase / PascalCase to snake_case
    return operationId
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
  }

  // Fallback: derive from method + path
  const pathSegments = apiPath
    .split('/')
    .filter(Boolean)
    .filter((s) => !s.startsWith('{'))
    .join('_');

  return `${httpMethod.toLowerCase()}_${pathSegments}`.replace(/[^a-z0-9_]/g, '_');
}

/**
 * Converts a snake_case or hyphenated string to camelCase.
 */
function toCamelCase(input: string): string {
  return input.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

/**
 * Processes a single OpenAPI operation into a ProcessedOperation.
 */
function processOperation(
  apiPath: string,
  method: string,
  operation: Operation,
): ProcessedOperation {
  const toolName = toToolName(operation.operationId, method, apiPath);
  const functionName = `register${toCamelCase(toolName).replace(/^./, (c) => c.toUpperCase())}Tool`;
  const description =
    operation.summary ?? operation.description ?? `${method} ${apiPath}`;

  const parameters: ProcessedParameter[] = (operation.parameters ?? []).map((param) => ({
    name: param.name,
    zodType: schemaToZod(param.schema, param.required ?? false),
    required: param.required ?? false,
    description: param.description ?? `${param.in} parameter: ${param.name}`,
    location: param.in,
  }));

  // Handle request body properties as parameters
  const hasRequestBody = Boolean(operation.requestBody);
  if (operation.requestBody?.content) {
    const jsonContent = operation.requestBody.content['application/json'];
    if (jsonContent?.schema?.properties) {
      const requiredFields = jsonContent.schema.required ?? [];
      for (const [propName, propSchema] of Object.entries(jsonContent.schema.properties)) {
        parameters.push({
          name: propName,
          zodType: schemaToZod(propSchema, requiredFields.includes(propName)),
          required: requiredFields.includes(propName),
          description: propSchema.description ?? `Request body field: ${propName}`,
          location: 'body',
        });
      }
    }
  }

  return {
    path: apiPath,
    method: method.toUpperCase(),
    toolName,
    functionName,
    description,
    parameters,
    hasRequestBody,
    operationId: operation.operationId ?? toolName,
  };
}

/**
 * Generates the TypeScript source code for a single MCP tool.
 *
 * @param op     - The processed operation
 * @param spec   - The full OpenAPI spec (for context)
 * @returns Complete TypeScript file content
 */
function generateToolFile(op: ProcessedOperation, spec: OpenApiSpec): string {
  const schemaFields = op.parameters
    .map((p) => `  ${p.name}: ${p.zodType},`)
    .join('\n');

  const schemaName = `${toCamelCase(op.toolName).replace(/^./, (c) => c.toUpperCase())}Schema`;

  // Build query/body params for the API call
  const queryParams = op.parameters
    .filter((p) => p.location === 'query')
    .map((p) => `    ${p.name}: params.${p.name} !== undefined ? String(params.${p.name}) : undefined,`)
    .join('\n');

  const hasQueryParams = queryParams.length > 0;

  return `/**
 * MCP Tool: ${op.toolName}
 *
 * Auto-generated by scripts/ingest-openapi.ts from ${spec.info.title} v${spec.info.version}
 * Operation: ${op.operationId}
 * Endpoint:  ${op.method} ${op.path}
 *
 * TODO: Review the generated schema and implement the API call logic.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api/client.js';

/**
 * Input schema for the \`${op.toolName}\` tool.
 * Generated from OpenAPI parameters — adjust constraints as needed.
 */
const ${schemaName} = z.object({
${schemaFields || '  // No parameters defined'}
});

/** TODO: Define the response type from the API spec */
interface ${toCamelCase(op.toolName).replace(/^./, (c) => c.toUpperCase())}Response {
  // TODO: Add response fields based on the API spec
  [key: string]: unknown;
}

/**
 * Registers the \`${op.toolName}\` tool.
 *
 * ${op.description}
 *
 * @param server - McpServer instance to register on.
 * @param client - Authenticated ApiClient for upstream requests.
 */
export function ${op.functionName}(server: McpServer, client: ApiClient): void {
  server.registerTool(
    '${op.toolName}',
    {
      description: '${op.description.replace(/'/g, "\\'")}',
      inputSchema: ${schemaName},
    },
    async (params) => {
      let response: ${toCamelCase(op.toolName).replace(/^./, (c) => c.toUpperCase())}Response;

      try {
        // TODO: Implement the API call
        response = await client.${op.method === 'GET' ? 'get' : 'post'}<${toCamelCase(op.toolName).replace(/^./, (c) => c.toUpperCase())}Response>(
          '${op.path}',
${op.method === 'GET' && hasQueryParams ? `          {
${queryParams}
          },` : op.method === 'GET' ? '          undefined,' : `          {
            // TODO: Add request body fields
          },`}
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          isError: true,
          content: [{ type: 'text' as const, text: \`❌ **Error:** \${message}\` }],
        };
      }

      // TODO: Format the response as markdown for the AI
      return {
        content: [
          {
            type: 'text' as const,
            text: \`## Result\\n\\n\${JSON.stringify(response, null, 2)}\`,
          },
        ],
      };
    },
  );
}
`;
}

/**
 * Main entry point for the OpenAPI ingestion script.
 * Reads the spec, processes all operations, and writes tool files.
 */
function main(): void {
  // Parse CLI args
  const args = process.argv.slice(2);
  const specArgIndex = args.indexOf('--spec');
  const specArgValue = specArgIndex !== -1 ? args[specArgIndex + 1] : undefined;
  const specPath =
    specArgValue !== undefined
      ? path.resolve(specArgValue)
      : path.join(PROJECT_ROOT, 'openapi.json');

  console.log('\n🔍 MCP Server — OpenAPI Ingestion Script');
  console.log('==========================================');
  console.log(`📄 Reading spec: ${specPath}`);

  const spec = readOpenApiSpec(specPath);

  console.log(`✅ Loaded: ${spec.info.title} v${spec.info.version}`);
  console.log(`📊 Paths found: ${String(Object.keys(spec.paths).length)}\n`);

  const operations: ProcessedOperation[] = [];

  // Process all paths and operations
  for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
    const methods: (keyof PathItem)[] = ['get', 'post', 'put', 'patch', 'delete'];
    for (const method of methods) {
      const operation = pathItem[method];
      if (operation) {
        operations.push(processOperation(apiPath, method, operation));
      }
    }
  }

  console.log(`🔧 Operations to generate: ${String(operations.length)}\n`);

  // Ensure the tools directory exists
  fs.mkdirSync(TOOLS_DIR, { recursive: true });

  const generatedFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const op of operations) {
    const fileName = `${op.toolName.replace(/_/g, '-')}.ts`;
    const filePath = path.join(TOOLS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      console.log(`⏭️  Skipping (already exists): ${fileName}`);
      skippedFiles.push(fileName);
      continue;
    }

    const content = generateToolFile(op, spec);
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`✅ Generated: src/tools/${fileName}`);
    console.log(`   Tool name:    ${op.toolName}`);
    console.log(`   Parameters:   ${String(op.parameters.length)}`);
    console.log(`   Description:  ${op.description.slice(0, 60)}...`);
    console.log('');

    generatedFiles.push(fileName);
  }

  // Summary
  console.log('\n==========================================');
  console.log('📦 Generation Summary');
  console.log('==========================================');
  console.log(`✅ Generated:  ${String(generatedFiles.length)} tool(s)`);
  console.log(`⏭️  Skipped:    ${String(skippedFiles.length)} tool(s) (already existed)`);

  if (generatedFiles.length > 0) {
    console.log('\n📝 Next steps:');
    console.log('  1. Review the generated files in src/tools/');
    console.log('  2. Implement the API call logic (marked with TODO comments)');
    console.log('  3. Add import and registration in src/tools/index.ts:');
    console.log('');

    for (const file of generatedFiles) {
      const toolName = file.replace('.ts', '');
      const funcName = `register${toCamelCase(toolName.replace(/-/g, '_')).replace(/^./, (c) => c.toUpperCase())}Tool`;
      console.log(`     import { ${funcName} } from './${toolName}.js';`);
    }

    console.log('');
    console.log('  4. Run pnpm typecheck to verify the generated code');
    console.log('  5. Run pnpm test to verify existing tests still pass\n');
  }
}

try {
  main();
} catch (err: unknown) {
  console.error('\n❌ Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
