import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MCPServerToolDefinition } from '../types/MCPServerTool';
import z from 'zod';
import { networkLogs } from '../playwright/browser.js';

export const getNetworkMessages: MCPServerToolDefinition = {
    name: 'get_network_messages',
    description: 'Get network requests and responses captured by the browser',
    schema: {
        count: z.number().optional().describe('Number of most recent network messages to return'),
        urlFilter: z.string().optional().describe('Filter messages by URL substring'),
        methodFilter: z.string().optional().describe('Filter messages by HTTP method (GET, POST, etc.)'),
        includeResponseData: z.boolean().optional().describe('Include response data in the output'),
    },
    handler: async (params: { count?: number; urlFilter?: string; methodFilter?: string; includeResponseData?: boolean }, context?: { sessionId?: string }): Promise<CallToolResult> => {
        console.log("Request from: ", context?.sessionId);

        const { count, urlFilter, methodFilter, includeResponseData = false } = params;

        let filteredLogs = [...networkLogs.values()];

        // Apply URL filter if provided
        if (urlFilter) {
            filteredLogs = filteredLogs.filter(entry =>
                entry.request.url().toLowerCase().includes(urlFilter.toLowerCase())
            );
        }
        if (methodFilter) {
            filteredLogs = filteredLogs.filter(entry =>
                entry.request.method().toUpperCase() === methodFilter.toUpperCase()
            );
        }

        const logs = filteredLogs.slice(-(count ?? 10));

        const formattedLogs = logs.map(entry => {
            const requestData = {
                url: entry.request.url(),
                method: entry.request.method(),
                headers: entry.request.headers(),
                postData: entry.request.postData(),
                resourceType: entry.request.resourceType(),
                isNavigationRequest: entry.request.isNavigationRequest(),
                frame: entry.request.frame()?.name() || 'main',
                timestamp: entry.timestamp,
            };

            const result: any = { request: requestData };

            if (entry.response && includeResponseData) {
                result.response = {
                    status: entry.response.status(),
                    statusText: entry.response.statusText(),
                    headers: entry.response.headers(),
                    url: entry.response.url(),
                    ok: entry.response.ok(),
                };
            } else if (entry.response) {
                result.hasResponse = true;
                result.responseStatus = entry.response.status();
            } else {
                result.hasResponse = false;
            }

            return result;
        });

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        networkMessages: formattedLogs,
                        totalCaptured: networkLogs.size,
                        filteredCount: formattedLogs.length
                    }, null, 2),
                },
            ],
            isError: false,
        };
    }
};
