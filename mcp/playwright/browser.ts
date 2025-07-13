import { Stagehand } from "@browserbasehq/stagehand";
import { chromium, type ConsoleMessage, type Request } from "playwright";

let stagehand: Stagehand | null = null;

function initNewStagehand(cdp?: string) {
    return new Stagehand({
        env: "LOCAL",
        modelName: "openai/gpt-4.1-mini",
        modelClientOptions: {
            apiKey: process.env.OPENAI_API_KEY,
        },

        localBrowserLaunchOptions: {
            viewport: undefined, // TODO Set to null
        },

        verbose: 1,
    });
}

export async function loadStagehand() {
    if (stagehand) {
        return stagehand;
    }

    let browser;

    try {
        stagehand = initNewStagehand("http://localhost:9222");
    } catch {
        stagehand = initNewStagehand();
    }

    await stagehand.init();

    const { page } = stagehand;
    await page.goto("http://localhost:5173");

    page.on("console", (msg) => {
        consoleLogs.push(msg);
    });
    page.on("request", (request) => {
        networkLogs.push(request);
    });

    return stagehand;
}
const consoleLogs: ConsoleMessage[] = [];
const networkLogs: Request[] = [];


const clearConsoleLogs = () => {
    consoleLogs.length = 0;
};


const clearNetworkLogs = () => {
    networkLogs.length = 0;
};

export { consoleLogs, clearConsoleLogs, networkLogs, clearNetworkLogs };
