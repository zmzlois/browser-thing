import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

export interface MCPServerToolDefinition {
    name: string;
    description: string;
    schema: ToolAnnotations,
    handler: (a: any, b: any) => Promise<CallToolResult>,
};
