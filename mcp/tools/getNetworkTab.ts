import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { MCPServerToolDefinition } from '../types/MCPServerTool';
export const getNetworkRequests: MCPServerToolDefinition = {
    name: 'get_network_requests',
    description: 'Retrieve network requests made by the page, optionally filtered by URL substring, HTTP method, or time range',
    schema: {
        urlSubstring: z.string().optional().describe('Substring to match in the request URL'),
        method: z.string().optional().describe('HTTP method to filter by (e.g., GET, POST)'),
        since: z.number().optional().describe('Unix timestamp (ms) to filter requests after this time'),
        until: z.number().optional().describe('Unix timestamp (ms) to filter requests before this time'),
    },
    handler: async ({ urlSubstring, method, since, until }: { urlSubstring?: string; method?: string; since?: number; until?: number }, context?: { sessionId?: string }): Promise<CallToolResult> => {
        // Mocked network requests
        const now = Date.now();
        const requests = [
            {
                url: 'https://example.com/api/data',
                method: 'GET',
                status: 200,
                requestHeaders: { 'Accept': 'application/json' },
                responseHeaders: { 'Content-Type': 'application/json' },
                startTime: now - 5000,
                endTime: now - 4990,
                duration: 10,
            },
            {
                url: 'https://example.com/api/submit',
                method: 'POST',
                status: 201,
                requestHeaders: { 'Content-Type': 'application/json' },
                responseHeaders: { 'Content-Type': 'application/json' },
                startTime: now - 3000,
                endTime: now - 2980,
                duration: 20,
            },
        ];

        // Apply filters if provided
        const filtered = requests.filter(req => {
            if (urlSubstring && !req.url.includes(urlSubstring)) return false;
            if (method && req.method !== method) return false;
            if (since && req.startTime < since) return false;
            if (until && req.endTime > until) return false;
            return true;
        });

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ sessionId: context?.sessionId, requests: filtered }, null, 2),
                },
            ],
            isError: false,
        };
    }
};
