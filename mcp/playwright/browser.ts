import { Stagehand } from "@browserbasehq/stagehand";

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

  await page.goto(url);
  await stagehand.page.waitForLoadState('networkidle');
}
