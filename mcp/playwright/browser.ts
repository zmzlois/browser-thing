import { chromium } from "playwright";
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "LOCAL",
  modelName: "openai/gpt-4.1-mini",
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  localBrowserLaunchOptions: {
    viewport: undefined, // TODO Set to null
  },
});

await stagehand.init();

const { page } = stagehand;
await page.goto("http://localhost:5173");

export { stagehand, page };
