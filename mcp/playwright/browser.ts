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

  return stagehand;
}
