import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { MCPServerToolDefinition } from '../types/MCPServerTool';

export const inspectElement: MCPServerToolDefinition = {
    name: 'inspect_element',
    description: 'Inspect an element on the page by CSS selector',
    schema: {
        selector: z.string().describe('CSS selector for the element to inspect'),
    },
    handler: async ({ selector }: { selector: string }, context?: { sessionId?: string }): Promise<CallToolResult> => {
        console.log("Request from: ", context?.sessionId);

        const fakeElementInfo = {
            selector,
            tag: 'div',
            id: 'example-id',
            classList: ['example-class'],
            innerText: 'Example text',
            attributes: {
                'data-example': 'value',
                'role': 'main',
            },
            boundingClientRect: {
                top: 100,
                left: 200,
                width: 300,
                height: 150,
            },
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ element: fakeElementInfo }, null, 2),
                },
            ],
            isError: false,
        };
    }
};
