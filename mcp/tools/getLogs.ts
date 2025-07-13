import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MCPServerToolDefinition } from '../types/MCPServerTool';
import z from 'zod';
import { consoleLogs } from '../playwright/browser.js';

const logTypes = ['log', 'debug', 'info', 'warn', 'error'] as const;
type LogType = typeof logTypes[number];

export const getConsoleLogs: MCPServerToolDefinition = {
    name: 'get_console_logs',
    description: 'Get console logs',
    schema: {
        count: z.number().optional().describe('Number of most recent logs to return'),
        type: z.enum(logTypes).optional().describe('Filter logs by type'),
    },
    handler: async (params: { count?: number, type?: LogType }, context?: { sessionId?: string }): Promise<CallToolResult> => {
        console.log("Request from: ", context?.sessionId);

        const { count, type } = params;

        const logMessages = consoleLogs
            .filter(log => type ? log.type() === type : true)
            .slice(-(count ?? 10));

        if (logMessages.length === 0) {
            return {
                content: [{ type: 'text', text: 'No logs found' }],
                isError: false,
            };
        }

        const logs = logMessages.map(log => ({
            type: log.type(),
            text: log.text(),
            location: log.location()
        }));

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ logs }, null, 2),
                },
            ],
            isError: false,
        };
    }
};
