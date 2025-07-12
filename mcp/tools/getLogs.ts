import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';


export const getConsoleLogs = {
    name: 'get_console_logs',
    description: 'Get console logs',
    schema: {},
    handler: async (_params: unknown, context?: { sessionId?: string }): Promise<CallToolResult> => {
        console.log("Request from: ", context?.sessionId);

        const fakeLogs = [
            '[2024-01-15 10:23:45] INFO: Server started on port 3000',
            '[2024-01-15 10:23:46] DEBUG: Database connection established',
            '[2024-01-15 10:24:12] INFO: User authentication successful for user@example.com',
            '[2024-01-15 10:24:15] WARN: Rate limit approaching for IP 192.168.1.100',
            '[2024-01-15 10:24:23] ERROR: Failed to process payment for order #12345',
            '[2024-01-15 10:24:30] INFO: Cache cleared successfully',
            '[2024-01-15 10:24:45] DEBUG: API request processed in 142ms',
            '[2024-01-15 10:25:01] INFO: Background job queue processed 15 items',
            '[2024-01-15 10:25:12] WARN: Memory usage at 85% threshold',
            '[2024-01-15 10:25:30] INFO: Scheduled backup completed successfully'
        ]; // TODO: get logs from the browser

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ logs: fakeLogs }, null, 2),
                },
            ],
        };
    }
};
