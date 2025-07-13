import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { MCPServerToolDefinition } from '../types/MCPServerTool.js';
import { navigate } from '../playwright/browser.js';

export const navigateTo: MCPServerToolDefinition = {
    name: 'navigate_to',
    description: 'Navigate the browser to the specified URL',
    schema: {
        url: z.string().url().describe('The URL to navigate to'),
    },
    handler: async (
        params: { url: string },
        context?: { sessionId?: string }
    ): Promise<CallToolResult> => {
        console.log('Navigating to URL for session:', context?.sessionId, params.url);

        await navigate(params.url);

        return {
            content: [
                {
                    type: 'text',
                    text: `Navigated to ${params.url}`,
                },
            ],
        };
    },
};
