import { Stagehand } from "@browserbasehq/stagehand";
import { type ConsoleMessage, type Request, type Response } from "playwright";

let stagehand: Stagehand | null = null;

interface NetworkEntry {
    request: Request;
    response?: Response;
    timestamp: number;
}

function initNewStagehand(cdpUrl?: string) {
    return new Stagehand({
        env: "LOCAL",
        modelName: "openai/gpt-4.1-mini",
        modelClientOptions: {
            apiKey: process.env.OPENAI_API_KEY,
        },

        localBrowserLaunchOptions: {
            viewport: undefined, // TODO Set to null
            cdpUrl,
        },

        verbose: 1,
    });
}

const consoleLogs: ConsoleMessage[] = [];
const networkLogs: Map<Request, NetworkEntry> = new Map();

export async function loadStagehand() {
    if (stagehand) {
        return stagehand;
    }

    try {
        stagehand = initNewStagehand("http://localhost:9222");
    } catch {
        stagehand = initNewStagehand();
    }
    if (!stagehand) {
        throw new Error("Failed to initialize Stagehand");
    }

    await stagehand.init();

    const page = stagehand?.page;
    console.log("Page ", page);

    page.on("console", (msg: ConsoleMessage) => {
        consoleLogs.push(msg);
    });

    page.on("request", (request: Request) => {
        console.log("Request", request.url(), request.method());
        networkLogs.set(request, {
            request,
            timestamp: Date.now()
        });
    });

    page.on("requestfailed", (request: Request) => {
        console.log("[FAILED]", request.method(), request.url(), request.failure());
    });

    page.on("response", async (response: Response) => {
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


export { consoleLogs, clearConsoleLogs, networkLogs, clearNetworkLogs, type NetworkEntry };
