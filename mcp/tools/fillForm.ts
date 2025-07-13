import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { MCPServerToolDefinition } from '../types/MCPServerTool.js';
import { loadStagehand } from '../playwright/browser.js';

export const fillForm: MCPServerToolDefinition = {
    name: 'fill_form',
    description: 'Fill out a form with name, email, subject, and message fields',
    schema: {
        name: z.string().describe('Full name of the user'),
        email: z.string().describe('Email address of the user'),
        subject: z.string().describe('Subject of the message'),
        message: z.string().describe('Message content'),
    },
    handler: async (
        params: { name: string; email: string; subject: string; message: string },
        context?: { sessionId?: string }
    ): Promise<CallToolResult> => {
        console.log('Filling form for session:', context?.sessionId);

        const stagehand = loadStagehand();
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

        const agent = await stagehand.agent().execute("Fill out the form with some sample data and submit it");
      
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
