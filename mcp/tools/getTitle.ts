import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const getTitle = {
    name: 'get_title',
    description: 'Get the title of the current page',
    schema: {},
    handler: async (_params: unknown, context?: { sessionId?: string }): Promise<CallToolResult> => {
        console.log("Request from: ", context?.sessionId);

        // const page = await getPage(0);
        const title = "Page Title!";

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ title }, null, 2),
                },
            ],
        };
    }
};
