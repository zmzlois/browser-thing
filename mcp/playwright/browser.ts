import { LogLine, Stagehand } from "@browserbasehq/stagehand";
import { type ConsoleMessage, type Request, type Response } from "playwright";
import { createWeaveClient } from "./provider.js";

let stagehand: Stagehand | null = null;

interface NetworkEntry {
    request: Request;
    response?: Response;
    timestamp: number;
}

function initNewStagehand(cdpUrl?: string) {
    const llmClient = createWeaveClient();
    return new Stagehand({
        env: "LOCAL",
        llmClient,
        localBrowserLaunchOptions: {
            // @ts-ignore
            viewport: null,
            cdpUrl,
        },
        logger: (message) =>
            console.error(
                logLineToString(message)
            ) /* Custom logging function to stderr */,
        verbose: 1,
    });
}

const consoleLogs: ConsoleMessage[] = [];
const networkLogs: Map<Request, NetworkEntry> = new Map();

export async function loadStagehand() {
    if (stagehand) {
        return stagehand;
    }

    stagehand = initNewStagehand();
    if (!stagehand) {
        throw new Error("Failed to initialize Stagehand");
    }

    await stagehand.init();

    const page = stagehand?.page;

    page.on("console", (msg) => {
        consoleLogs.push(msg);
    });

    page.on("request", (request) => {
        networkLogs.set(request, {
            request,
            timestamp: Date.now()
        });
    });

    page.on("requestfailed", (request) => {
        console.log("[Network Request Failed]", request.method(), request.url(), request.failure());
    });

    page.on("response", async (response) => {
        const request = response.request();

        const entry = networkLogs.get(request);
        if (entry) {
            entry.response = response;
            entry.timestamp = Date.now();
            networkLogs.set(request, {
                request,
                response,
                timestamp: Date.now()
            });
        }
    });

    await page.goto("http://localhost:5173");

    await page.waitForLoadState("networkidle");

    return stagehand;
}

const clearConsoleLogs = () => {
    consoleLogs.length = 0;
};

const clearNetworkLogs = () => {
    networkLogs.clear();
};

// Helper function to convert LogLine to string
export function logLineToString(logLine: LogLine): string {
  const timestamp = logLine.timestamp ? new Date(logLine.timestamp).toISOString() : new Date().toISOString();
  const level = logLine.level !== undefined ? 
    (logLine.level === 0 ? 'DEBUG' : 
     logLine.level === 1 ? 'INFO' : 
     logLine.level === 2 ? 'ERROR' : 'UNKNOWN') : 'UNKNOWN';
  return `[${timestamp}] [${level}] ${logLine.message || ''}`;
}

export { consoleLogs, clearConsoleLogs, networkLogs, clearNetworkLogs, type NetworkEntry };
