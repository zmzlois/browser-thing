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

/**
 * Load Stagehand on the last page that was navigated to.
 *
 * If the navigate endpoint was never called, this will return null.
 */
export function loadStagehand() {
  return stagehand;
}

const consoleLogs: ConsoleMessage[] = [];
const networkLogs: Request[] = [];

export const clearConsoleLogs = () => {
  consoleLogs.length = 0;
};

export const clearNetworkLogs = () => {
  networkLogs.length = 0;
};

export async function navigate(url: string) {
  if (!stagehand) {
    try {
      stagehand = initNewStagehand("http://localhost:9222");
    } catch {
      stagehand = initNewStagehand();
    }

    await stagehand.init();
  }

  const { page } = stagehand;

  page.on("console", (msg) => {
    consoleLogs.push(msg);
  });
  page.on("request", (request) => {
    networkLogs.push(request);
  });

  await page.goto(url);
  await stagehand.page.waitForLoadState("networkidle");
}
