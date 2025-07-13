#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import * as weave from 'weave';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isInitializeRequest, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getConsoleLogs } from './tools/getLogs.js';
import { inspectElement } from './tools/inspectElement.js';
import { getNetworkMessages } from './tools/getNetworkMessages.js';
import { navigateTo } from './tools/navigateTo.js';
import { executeInBrowser } from './tools/executeInBrowser.js';
import { cleanLogs } from './tools/cleanLogs.js';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

// Create a tracer for MCP operations
const tracer = trace.getTracer('mcp-server');

// Parse command line arguments
const args = process.argv.slice(2);
const useHttp = args.includes('--http');

// Set up environment variables
process.env.WANDB_PROJECT_NAME = process.env.WANDB_PROJECT_NAME || 'frontline_mcp';
process.env.WANDB_API_KEY = process.env.WANDB_API_KEY || 'a3ef6dce3a8a7dc096caa257f428e0525f81116d';

await weave.init(process.env.WANDB_PROJECT_NAME);

const getServer = () => {
    const server = new McpServer({
        name: useHttp ? 'browser-mcp-http-server' : 'browser-mcp-stdio-server',
        version: '1.0.0',
    }, {
        capabilities: {
            logging: {},
        }
    });

    // Wrap tool handlers with tracing
    const wrapToolHandler = (toolName: string, handler: any) => {
        return async (params: unknown, context?: { sessionId?: string }): Promise<CallToolResult> => {
            const span = tracer.startSpan(`mcp.tool.${toolName}`, {
                attributes: {
                    'mcp.tool.handler': handler.name,
                    'mcp.tool.name': toolName,
                    'mcp.session.id': context?.sessionId || 'unknown',
                    'mcp.params': JSON.stringify(params),
                }
            });

            try {
                const result = await handler(params, context);
                span.setStatus({ code: SpanStatusCode.OK });
                span.setAttribute('mcp.result.success', true);
                return result;
            } catch (error) {
                span.setStatus({ 
                    code: SpanStatusCode.ERROR, 
                    message: error instanceof Error ? error.message : 'Unknown error' 
                });
                span.setAttribute('mcp.result.success', false);
                span.setAttribute('mcp.error', error instanceof Error ? error.message : 'Unknown error');
                throw error;
            } finally {
                span.end();
            }
        };
    };

    server.tool(
        getConsoleLogs.name,
        getConsoleLogs.description,
        getConsoleLogs.schema,
        wrapToolHandler('get_console_logs', getConsoleLogs.handler)
    );

    server.tool(
        inspectElement.name,
        inspectElement.description,
        inspectElement.schema,
        wrapToolHandler('inspect_element', inspectElement.handler)
    );

    server.tool(
        getNetworkMessages.name,
        getNetworkMessages.description,
        getNetworkMessages.schema,
        wrapToolHandler('get_network_messages', getNetworkMessages.handler)
    );

    server.tool(
        executeInBrowser.name,
        executeInBrowser.description,
        executeInBrowser.schema,
        executeInBrowser.handler
    );

    server.tool(
        navigateTo.name,
        navigateTo.description,
        navigateTo.schema,
        wrapToolHandler('navigate_to', navigateTo.handler)
    );

    server.tool(
        cleanLogs.name,
        cleanLogs.description,
        cleanLogs.schema,
        wrapToolHandler('clean_logs', cleanLogs.handler)
    );

    return server;
};

async function runStdioServer() {
    const server = getServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.error('MCP server is running on stdio...');
}

async function runHttpServer() {
    // Dynamic import to avoid loading Express dependencies when using stdio
    const { default: express } = await import('express');
    const { default: cors } = await import('cors');
    
    const app = express();
    app.use(express.json());

    // Add tracing middleware for HTTP requests
    app.use((req, res, next) => {
        const span = tracer.startSpan('http.request', {
            attributes: {
                'http.method': req.method,
                'http.url': req.url,
                'http.target': req.path,
                'http.host': req.get('host'),
                'http.user_agent': req.get('user-agent'),
                'http.request_id': req.headers['x-request-id'] || randomUUID(),
            }
        });

        // Add span to context
        const ctx = trace.setSpan(context.active(), span);

        // Override res.end to capture response
        const originalEnd = res.end;
        res.end = function(chunk?: any, encoding?: any) {
            span.setAttributes({
                'http.status_code': res.statusCode,
                'http.status_text': res.statusMessage,
            });

            if (res.statusCode >= 400) {
                span.setStatus({ code: SpanStatusCode.ERROR });
            } else {
                span.setStatus({ code: SpanStatusCode.OK });
            }

            span.end();
            return originalEnd.call(this, chunk, encoding);
        };

        context.with(ctx, () => next());
    });

    // Configure CORS to expose Mcp-Session-Id header for browser-based clients
    app.use(cors({
        origin: '*', // Allow all origins - adjust as needed for production
        exposedHeaders: ['Mcp-Session-Id']
    }));

    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    app.post('/mcp', async (req, res) => {
        const span = tracer.startSpan('mcp.request', {
            attributes: {
                'mcp.endpoint': '/mcp',
                'mcp.method': 'POST',
                'mcp.body_size': JSON.stringify(req.body).length,
            }
        });

        try {            
            // Check for existing session ID
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            let transport: StreamableHTTPServerTransport;

            if (sessionId && transports[sessionId]) {
                // Reuse existing transport
                span.setAttribute('mcp.session.reused', true);
                span.setAttribute('mcp.session.id', sessionId);
                transport = transports[sessionId];
            } else if (!sessionId && isInitializeRequest(req.body)) {
                // New initialization request - use JSON response mode
                span.setAttribute('mcp.session.new', true);
                
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    enableJsonResponse: true, // Enable JSON response mode
                    onsessioninitialized: (sessionId) => {
                        // Store the transport by session ID when session is initialized
                        // This avoids race conditions where requests might come in before the session is stored
                        transports[sessionId] = transport;
                        span.setAttribute('mcp.session.id', sessionId);
                    }
                });

                // Connect the transport to the MCP server BEFORE handling the request
                const server = getServer();
                await server.connect(transport);
                await transport.handleRequest(req, res, req.body);
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return; // Already handled
            } else {
                // Invalid request - no session ID or not initialization request
                span.setStatus({ 
                    code: SpanStatusCode.ERROR, 
                    message: 'Bad Request: No valid session ID provided' 
                });
                span.end();
                
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
            span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
            console.error('Error handling MCP request:', error);
            span.setStatus({ 
                code: SpanStatusCode.ERROR, 
                message: error instanceof Error ? error.message : 'Unknown error' 
            });
            
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
        } finally {
            span.end();
        }
    });

    app.get('/mcp', async (req, res) => {
        const span = tracer.startSpan('mcp.request', {
            attributes: {
                'mcp.endpoint': '/mcp',
                'mcp.method': 'GET',
            }
        });

        try {
            // Since this is a very simple example, we don't support GET requests for this server
            // The spec requires returning 405 Method Not Allowed in this case
            span.setStatus({ 
                code: SpanStatusCode.ERROR, 
                message: 'Method Not Allowed' 
            });
            
            res.status(405).set('Allow', 'POST').send('Method Not Allowed');
        } finally {
            span.end();
        }
    });

    // Start the server
    const PORT = 4000;
    const HOST = '0.0.0.0'; // Bind to all network interfaces

    const server = app.listen(PORT, HOST, () => {
        const span = tracer.startSpan('server.startup');
        span.setAttributes({
            'server.port': PORT,
            'server.host': HOST,
            'server.url': `http://${HOST}:${PORT}`,
        });
        
        console.log(`MCP HTTP Server listening on http://${HOST}:${PORT}`);
        console.log(`Access from local network: http://<your-local-ip>:${PORT}/mcp`);
        
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
    });

    // Handle server shutdown
    process.on('SIGINT', async () => {
        const span = tracer.startSpan('server.shutdown');
        
        try {
            server.close(() => {
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                process.exit(0);
            });
        } catch (error) {
            span.setStatus({ 
                code: SpanStatusCode.ERROR, 
                message: error instanceof Error ? error.message : 'Unknown error' 
            });
            span.end();
            process.exit(1);
        }
    });
}

// Run the appropriate server based on command line arguments
if (useHttp) {
    runHttpServer().catch((error) => {
        console.error('Failed to start HTTP server:', error);
        process.exit(1);
    });
} else {
    runStdioServer().catch((error) => {
        console.error('Failed to start stdio server:', error);
        process.exit(1);
    });
}
