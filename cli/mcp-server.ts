#!/usr/bin/env node
// TODO: delete this 
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';
import { getConsoleLogs } from '../mcp/tools/getLogs.js';
import { inspectElement } from '../mcp/tools/inspectElement.js';
import { getNetworkRequests } from '../mcp/tools/getNetworkTab.js';

const getServer = () => {
    const server = new McpServer({
        name: 'browser-thing-mcp-server',
        version: '1.0.0',
    }, {
        capabilities: {
            logging: {},
        }
    });

    server.tool(
        getConsoleLogs.name,
        getConsoleLogs.description,
        getConsoleLogs.schema,
        getConsoleLogs.handler
    );

    server.tool(
        inspectElement.name,
        inspectElement.description,
        inspectElement.schema,
        inspectElement.handler
    );

    server.tool(
        getNetworkRequests.name,
        getNetworkRequests.description,
        getNetworkRequests.schema,
        getNetworkRequests.handler
    );

    return server;
}

const app = express();
app.use(express.json());

// Configure CORS to expose Mcp-Session-Id header for browser-based clients
app.use(cors({
    origin: '*', // Allow all origins - adjust as needed for production
    exposedHeaders: ['Mcp-Session-Id']
}));

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post('/mcp', async (req: Request, res: Response) => {
    console.log('Received MCP request:', req.body);
    try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            transport = transports[sessionId];
        } else if (!sessionId && req.body.method === 'initialize') {
            // New initialization request - use JSON response mode
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                enableJsonResponse: true, // Enable JSON response mode
                onsessioninitialized: (sessionId) => {
                    // Store the transport by session ID when session is initialized
                    console.log(`Session initialized with ID: ${sessionId}`);
                    transports[sessionId] = transport;
                }
            });

            // Connect the transport to the MCP server BEFORE handling the request
            const server = getServer();
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            return; // Already handled
        } else {
            // Invalid request - no session ID or not initialization request
            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Bad Request: No valid session ID provided',
                },
                id: null,
            });
            return;
        }

        // Handle the request with existing transport - no need to reconnect
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            });
        }
    }
});

app.get('/mcp', async (req: Request, res: Response) => {
    // Since this is a very simple example, we don't support GET requests for this server
    // The spec requires returning 405 Method Not Allowed in this case
    res.status(405).set('Allow', 'POST').send('Method Not Allowed');
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ 
        status: 'healthy', 
        service: 'browser-thing-mcp-server',
        version: '1.0.0',
        endpoints: {
            mcp: '/mcp',
            health: '/health'
        }
    });
});

// Start the server
const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 4000;
const HOST = '0.0.0.0'; // Bind to all network interfaces
app.listen(PORT, HOST, (error) => {
    if (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
    console.log(`🚀 BrowserThing MCP Server listening on http://${HOST}:${PORT}`);
    console.log(`📡 MCP endpoint: http://${HOST}:${PORT}/mcp`);
    console.log(`💚 Health check: http://${HOST}:${PORT}/health`);
    console.log(`🌐 Access from local network: http://<your-local-ip>:${PORT}`);
    console.log('\n📋 Available tools:');
    console.log('   • get_console_logs - Get browser console logs');
    console.log('   • inspect_element - Inspect DOM elements');
    console.log('   • get_network_requests - Get network request data');
});

// Handle server shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down MCP server...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down MCP server...');
    process.exit(0);
}); 