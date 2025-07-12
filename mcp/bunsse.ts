// running bun an sse mcp server with express don't work in Bun
// so i wrote a new transport layer for bun

import contentType from "content-type";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
	JSONRPCMessageSchema,
	type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadableStreamController } from "bun";

/**
 * Server-Sent Events (SSE) transport implementation for MCP
 * Handles bidirectional communication through SSE for client-server interaction
 * Implements the Transport interface for Model Context Protocol
 */
export class SSEServerTransport implements Transport {
	protected _sessionId: string;
	protected _endpoint: string;
	protected _request: Request | null;
	protected _response: Response | null;
	protected _controller: ReadableStreamController<unknown> | null;
	protected _maximumMessageSize = 4 * 1024 * 1024;

	onclose?: () => void;
	onerror?: (error: Error) => void;
	onmessage?: (message: JSONRPCMessage) => void;

	/**
	 * Constructs a new SSEServerTransport instance
	 * @param endpoint - The endpoint path where clients will send POST messages
	 * @param sessionId - Optional unique identifier for the session. Generated if not provided
	 */
	constructor(endpoint: string, sessionId?: string) {
		this._sessionId = sessionId ?? crypto.randomUUID();
		this._endpoint = endpoint;
		this._request = null;
		this._response = null;
		this._controller = null;
	}

	/**
	 * Formats and sends an SSE message to the connected client
	 * @param data - The payload to send to the client
	 * @param event - Optional event type identifier for the SSE message
	 * @throws Error if the transport is not connected (no controller)
	 */
	protected _send(data: string, event?: string) {
		if (!this._controller) {
			throw new Error("Not connected");
		}

		const message = new TextEncoder().encode(
			`${event ? `event: ${event}\n` : ""}data: ${data}\n\n`,
		);
		this._controller?.enqueue(message);
	}

	/**
	 * Initializes the SSE connection and starts the stream
	 * Must be called after setting the request property
	 * @throws Error if transport is already started or request is not set
	 */
	async start(): Promise<void> {
		const self = this;

		if (self._response) {
			if (this._response) {
				throw new Error(
					"SSEServerTransport already started! If using Server class, note that connect() calls start() automatically.",
				);
			}
			return;
		}

		if (self._request === null) {
			throw new Error("setRequest must be called before start");
		}

		const { signal } = self._request;

		self._response = new Response(
			new ReadableStream({
				start(controller) {
					self._controller = controller;
					signal.onabort = async () => {
						await self.close();
					};
				},
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			},
		);

		this._send(
			`${encodeURI(this._endpoint)}?sessionId=${this._sessionId}`,
			"endpoint",
		);

		return Promise.resolve();
	}

	async send(message: JSONRPCMessage): Promise<void> {
		this._send(JSON.stringify(message), "message");
	}

	async close(): Promise<void> {
		console.log("Closing SSE server");
		if (this._controller) {
			this._controller.close();
			this._controller = null;
		}
		if (this._response) {
			this._response = null;
		}
		if (this._request) {
			this._request = null;
		}
		this.onclose?.();
	}

	/**
	 * Handles incoming POST messages from clients
	 * Validates content-type, message size, and processes the message
	 * @param req - The HTTP request object
	 * @param parsedBody - Optional pre-parsed body to avoid parsing twice
	 * @returns HTTP response with appropriate status code
	 */
	async handlePostMessage(
		req: Request,
		parsedBody?: unknown,
	): Promise<Response> {
		if (!this._response) {
			const message = "SSE connection not established";
			return new Response(message, { status: 500 });
		}

		let body: string | unknown;

		try {
			const ct = contentType.parse(req.headers.get("content-type") ?? "");
			if (ct.type !== "application/json") {
				throw new Error(`Unsupported content-type: ${ct}`);
			}
			body = parsedBody;
			if (!body) {
				const text = await req.text();
				if (
					this._maximumMessageSize &&
					text.length > this._maximumMessageSize
				) {
					throw new Error(
						`Message too large: ${text.length} > ${this._maximumMessageSize}`,
					);
				}
				body = text;
			}
		} catch (error) {
			this.onerror?.(error as Error);
			return new Response(String(error), { status: 400 });
		}

		try {
			this.handleMessage(typeof body === "string" ? JSON.parse(body) : body);
		} catch {
			return new Response(`Invalid message: ${body}`, { status: 400 });
		}

		return new Response("Accepted", { status: 202 });
	}

	/**
	 * Validates and processes an incoming message
	 * @param message - The raw message to be processed
	 * @throws Error if message fails JSON-RPC schema validation
	 */
	handleMessage(message: unknown) {
		let parsedMessage: JSONRPCMessage;
		try {
			parsedMessage = JSONRPCMessageSchema.parse(message);
		} catch (error) {
			this.onerror?.(error as Error);
			throw error;
		}

		this.onmessage?.(parsedMessage);
	}

	set request(request: Request) {
		this._request = request;
	}

	set maximumMessageSize(size: number) {
		this._maximumMessageSize = size;
	}

	get response(): Response {
		if (!this._response) {
			throw new Error("SSE server not started");
		}
		return this._response;
	}

	get sessionId(): string {
		return this._sessionId;
	}
}

/**
 * Session data structure to store transport, server, and message history
 */
interface SessionData {
	transport: SSEServerTransport;
	server: McpServer;
	messageHistory: Array<{
		timestamp: Date;
		direction: 'inbound' | 'outbound';
		message: JSONRPCMessage;
	}>;
}

/**
 * Global sessions map for accessing session data from tools
 */
let globalSessions: Map<string, SessionData> | null = null;

/**
 * Get message history for a specific session
 * @param sessionId - The session ID to get history for
 * @returns Array of messages with timestamps and directions, or null if session not found
 */
export function getSessionHistory(sessionId: string) {
	if (!globalSessions) {
		return null;
	}

	const session = globalSessions.get(sessionId);
	return session?.messageHistory || null;
}

/**
 * Get all active session IDs
 * @returns Array of active session IDs
 */
export function getActiveSessions(): string[] {
	if (!globalSessions) {
		return [];
	}

	return Array.from(globalSessions.keys());
}

/**
 * Creates and starts an MCP server with SSE transport
 * @param port - Port number to listen on
 * @param sseEndpoint - Endpoint path for establishing SSE connections (GET requests)
 * @param messageEndpoint - Endpoint path for receiving client messages (POST requests)
 * @param mcpServerFactory - Factory function that creates new MCP server instances
 * @returns Bun server instance handling SSE connections and messages
 */
export function startMCPSSEServer(
	port: number,
	sseEndpoint: string,
	messageEndpoint: string,
	mcpServerFactory: () => McpServer,
) {
	console.log(`Starting SSE server on port ${port}`);
	const sessions: Map<string, SessionData> = new Map();

	// Make sessions accessible globally
	globalSessions = sessions;

	return Bun.serve({
		port,
		hostname: "0.0.0.0",
		idleTimeout: 0,
		async fetch(req) {
			const url = new URL(req.url);
			const pathname = url.pathname;
			console.debug(`Got new request <${req.method}> <${pathname}>`);
			switch (req.method) {
				case "GET":
					if (pathname === "/ping") {
						return new Response("OK", { status: 200 });
					}
					if (pathname === sseEndpoint) {
						const transport = new SSEServerTransport(messageEndpoint);
						transport.request = req;
						const server = mcpServerFactory();

						// Store message history for this session
						const sessionData: SessionData = {
							transport,
							server,
							messageHistory: []
						};

						// Hook into message handling to track messages
						const originalOnMessage = transport.onmessage;
						transport.onmessage = (message: JSONRPCMessage) => {
							// Store inbound message
							sessionData.messageHistory.push({
								timestamp: new Date(),
								direction: 'inbound',
								message
							});

							// Call original handler
							originalOnMessage?.(message);
						};

						// Hook into server send to track outbound messages
						const originalSend = transport.send.bind(transport);
						transport.send = async (message: JSONRPCMessage) => {
							// Store outbound message
							sessionData.messageHistory.push({
								timestamp: new Date(),
								direction: 'outbound',
								message
							});

							return originalSend(message);
						};

						await server.connect(transport);
						sessions.set(transport.sessionId, sessionData);
						return transport.response;
					}
					break;
				case "POST":
					if (pathname === messageEndpoint) {
						const sessionId = url.searchParams.get("sessionId");
						if (!sessionId) {
							return new Response("Session ID not found", { status: 400 });
						}
						const session = sessions.get(sessionId);
						if (!session) {
							return new Response("Session not found", { status: 404 });
						}
						return session.transport.handlePostMessage(req);
					}
					break;
			}
			return new Response("Not found", { status: 404 });
		},
	});
}
