import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { MCPServerToolDefinition } from '../types/MCPServerTool.js';
import { loadStagehand } from '../playwright/browser.js';

export const executeInBrowser: MCPServerToolDefinition = {
    name: 'execute_in_browser',
    description: 'Execute a natural language command in the browser and return the result',
    schema: {
        command: z.string().describe('A natural language request to perform in the browser. For instance: fill in the form with sample data and submit it.'),
    },
    handler: async (
        params: { command: string },
        context?: { sessionId?: string }
    ): Promise<CallToolResult> => {
        console.log('Executing in browser for session:', context?.sessionId, 'Command:', params.command);

        const stagehand = await loadStagehand();
        if (!stagehand) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: "Please navigate to a page first."
                    },
                ],
            };
        }

        const agent = await stagehand.agent().execute(params.command);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: agent.success,
                        message: agent.message,
                        actions: agent.actions,
                    }, null, 2),
                },
            ],
            isError: false,
        };
    },
};
