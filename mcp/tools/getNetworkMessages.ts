import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MCPServerToolDefinition } from '../types/MCPServerTool';
import z from 'zod';
import { networkLogs } from '../playwright/browser.js';

export const getNetworkMessages: MCPServerToolDefinition = {
    name: 'get_network_messages',
    description: 'Get network messages/requests captured by the browser',
    schema: {
        count: z.number().optional().describe('Number of most recent network messages to return'),
        urlFilter: z.string().optional().describe('Filter messages by URL substring'),
        methodFilter: z.string().optional().describe('Filter messages by HTTP method (GET, POST, etc.)'),
    },
    handler: async (params: { count?: number; urlFilter?: string; methodFilter?: string }, context?: { sessionId?: string }): Promise<CallToolResult> => {
        console.log("Request from: ", context?.sessionId);
        const { count, urlFilter, methodFilter } = params;

        let filteredLogs = [...networkLogs];

        // Apply URL filter if povided
        if (urlFilter) {
            filteredLogs = filteredLogs.filter(log =>
                log.url().toLowerCase().includes(urlFilter.toLowerCase())
            );
        }
        if (methodFilter) {
            filteredLogs = filteredLogs.filter(log =>
                log.method().toUpperCase() === methodFilter.toUpperCase()
            );
        }

        const logs = filteredLogs.slice(-(count ?? 10));

        const formattedLogs = logs.map(log => ({
            url: log.url(),
            method: log.method(),
            headers: log.headers(),
            postData: log.postData(),
            resourceType: log.resourceType(),
            isNavigationRequest: log.isNavigationRequest(),
            frame: log.frame()?.name() || 'main',
        }));

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        networkMessages: formattedLogs,
                        totalCaptured: networkLogs.length,
                        filteredCount: formattedLogs.length
                    }, null, 2),
                },
            ],
        };
    }
};
