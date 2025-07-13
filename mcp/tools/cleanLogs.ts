import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MCPServerToolDefinition } from '../types/MCPServerTool';
import z from 'zod';
import { clearConsoleLogs, clearNetworkLogs } from '../playwright/browser.js';

export const cleanLogs: MCPServerToolDefinition = {
    name: 'clean_logs',
    description: 'Clean up console logs and network logs to free up memory',
    schema: {
        type: z.enum(['console', 'network', 'all']).optional().describe('Type of logs to clean (default: all)'),
    },
    handler: async (params: { type?: 'console' | 'network' | 'all' }, context?: { sessionId?: string }): Promise<CallToolResult> => {
        console.log("Clean logs request from: ", context?.sessionId);

        const { type = 'all' } = params;

        try {
            if (type === 'console' || type === 'all') {
                clearConsoleLogs();
            }
            
            if (type === 'network' || type === 'all') {
                clearNetworkLogs();
            }

            const message = type === 'all' 
                ? 'Successfully cleaned both console and network logs'
                : `Successfully cleaned ${type} logs`;

            return {
                content: [{ type: 'text', text: message }],
                isError: false,
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Failed to clean logs: ${error}` }],
                isError: true,
            };
        }
    }
};
