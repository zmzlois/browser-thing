import express from "express";
import cors from "cors";
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getConsoleLogs } from '../mcp/tools/getLogs.js';
import { inspectElement } from '../mcp/tools/inspectElement.js';
import { getNetworkRequests } from '../mcp/tools/getNetworkTab.js';
import { cyan, red, yellow } from "picocolors";
import { outro } from "@clack/prompts";
// TODO: delete this 
export class BrowserThingServer {
  public app: express.Application;
  private server: any;
  private serverPort: number = 0;
  private mcpServer!: McpServer;
  private mcpTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupEndpoints();
    this.initializeMcpServer();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id']
    }));
    this.app.use(express.json());
  }

  private initializeMcpServer() {
    this.mcpServer = new McpServer({
      name: 'browser-thing-mcp-server',
      version: '1.0.0',
    }, {
      capabilities: {
        logging: {},
      }
    });

    // Register MCP tools
    this.mcpServer.tool(
      getConsoleLogs.name,
      getConsoleLogs.description,
      getConsoleLogs.schema,
      getConsoleLogs.handler
    );

    this.mcpServer.tool(
      inspectElement.name,
      inspectElement.description,
      inspectElement.schema,
      inspectElement.handler
    );

    this.mcpServer.tool(
      getNetworkRequests.name,
      getNetworkRequests.description,
      getNetworkRequests.schema,
      getNetworkRequests.handler
    );
  }

  private setupEndpoints() {
    // MCP endpoint
    this.app.post('/mcp', async (req: any, res: any) => {
      console.log('Received MCP request:', req.body);
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.mcpTransports[sessionId]) {
          transport = this.mcpTransports[sessionId];
        } else if (!sessionId && req.body.method === 'initialize') {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true,
            onsessioninitialized: (sessionId) => {
              console.log(`MCP Session initialized with ID: ${sessionId}`);
              this.mcpTransports[sessionId] = transport;
            }
          });

          await this.mcpServer.connect(transport);
          await transport.handleRequest(req, res, req.body);
          return;
        } else {
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

    this.app.get('/mcp', async (req: any, res: any) => {
      res.status(405).set('Allow', 'POST').send('Method Not Allowed');
    });

    // Error handling endpoints for Stagehand communication
    this.app.post('/error', (req, res) => {
      const { errorType, message, url } = req.body;
      
      console.log('\n');
      
      switch (errorType) {
        case 'NETWORK_ERROR':
          console.log(red('❌ Network Error'));
          console.log(yellow(`Could not connect to: ${url}`));
          console.log(yellow('Please check if your application is running and the URL is correct.'));
          break;
          
        case 'TIMEOUT_ERROR':
          console.log(red('⏰ Timeout Error'));
          console.log(yellow(`Request to ${url} timed out.`));
          console.log(yellow('The application might be slow to respond or not running.'));
          break;
          
        case 'DNS_ERROR':
          console.log(red('🌐 DNS Error'));
          console.log(yellow(`Could not resolve hostname for: ${url}`));
          console.log(yellow('Please check the URL and ensure the hostname is correct.'));
          break;
          
        case 'SSL_ERROR':
          console.log(red('🔒 SSL/TLS Error'));
          console.log(yellow(`SSL certificate error for: ${url}`));
          console.log(yellow('If this is a local development server, try using http:// instead of https://'));
          break;
          
        case 'HTTP_ERROR':
          console.log(red('📡 HTTP Error'));
          console.log(yellow(`HTTP error ${req.body.statusCode || 'unknown'} for: ${url}`));
          console.log(yellow('The server returned an error response.'));
          break;
          
        case 'BROWSER_ERROR':
          console.log(red('🌍 Browser Error'));
          console.log(yellow(`Browser could not load: ${url}`));
          console.log(yellow('This might be due to CORS, content blocking, or browser security policies.'));
          break;
          
        default:
          console.log(red('❌ Unknown Error'));
          console.log(yellow(`Error accessing: ${url}`));
          console.log(yellow(`Message: ${message}`));
      }
      
      console.log('\n' + cyan('💡 Troubleshooting tips:'));
      console.log('   • Make sure your application is running');
      console.log('   • Check if the port number is correct');
      console.log('   • Verify the URL starts with http:// or https://');
      console.log('   • Try accessing the URL directly in your browser');
      console.log('   • Check for any firewall or network restrictions\n');
      
      res.json({ received: true });
      outro('Browser test failed due to URL error ❌');
      process.exit(1);
    });

    this.app.post('/success', (req, res) => {
      const { url, metrics } = req.body;
      console.log('\n' + cyan('✅ Successfully connected to:') + ` ${url}`);
      if (metrics) {
        console.log(cyan('📊 Test metrics:'), metrics);
      }
      res.json({ received: true });
    });

    this.app.post('/progress', (req, res) => {
      const { message, step } = req.body;
      console.log(cyan(`🔄 ${message}`));
      res.json({ received: true });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'browser-thing-server',
        version: '1.0.0',
        endpoints: {
          mcp: '/mcp',
          health: '/health',
          error: '/error',
          success: '/success',
          progress: '/progress'
        }
      });
    });
  }

  async start(port?: number): Promise<number> {
    return new Promise((resolve) => {
      if (port) {
        // Start on specific port
        this.server = this.app.listen(port, () => {
          this.serverPort = port;
          resolve(this.serverPort);
        });
      } else {
        // Start on random port
        this.server = this.app.listen(0, () => {
          this.serverPort = (this.server.address() as any).port;
          resolve(this.serverPort);
        });
      }
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
  }

  getPort(): number {
    return this.serverPort;
  }

  getMcpEndpoint(): string {
    return `http://localhost:${this.serverPort}/mcp`;
  }

  getHealthEndpoint(): string {
    return `http://localhost:${this.serverPort}/health`;
  }
} 