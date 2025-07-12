import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { page } from '../playwright/browser.js';
import type { MCPServerToolDefinition } from '../types/MCPServerTool.js';

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

        const filled = {
            name: params.name,
            email: params.email,
            subject: params.subject,
            message: params.message,
        };

        await page.fill('input[name="name"]', params.name);
        await page.fill('input[name="email"]', params.email);
        await page.fill('input[name="subject"]', params.subject);
        await page.fill('textarea[name="message"]', params.message);
        await page.click('button[type="submit"]');

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ filled }, null, 2),
                },
            ],
        };
    },
};
