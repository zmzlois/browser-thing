import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays, actWithCache } from "./utils.js";
import { z } from "zod";

// Function to send error reports back to CLI server
async function reportError(errorType: string, message: string, url: string, statusCode?: number) {
  const cliServerPort = process.env.CLI_SERVER_PORT;
  if (!cliServerPort) return;

  try {
    const response = await fetch(`http://localhost:${cliServerPort}/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        errorType,
        message,
        url,
        statusCode,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to report error to CLI server');
    }
  } catch (error) {
    console.error('Error reporting to CLI server:', error);
  }
}

// Function to send success reports back to CLI server
async function reportSuccess(url: string, metrics?: any) {
  const cliServerPort = process.env.CLI_SERVER_PORT;
  if (!cliServerPort) return;

  try {
    const response = await fetch(`http://localhost:${cliServerPort}/success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        metrics,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to report success to CLI server');
    }
  } catch (error) {
    console.error('Error reporting success to CLI server:', error);
  }
}

// Function to send progress updates back to CLI server
async function reportProgress(message: string, step?: string) {
  const cliServerPort = process.env.CLI_SERVER_PORT;
  if (!cliServerPort) return;

  try {
    const response = await fetch(`http://localhost:${cliServerPort}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        step,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to report progress to CLI server');
    }
  } catch (error) {
    console.error('Error reporting progress to CLI server:', error);
  }
}

/**
 * 🤘 Welcome to Stagehand! Thanks so much for trying us out!
 * 🛠️ CONFIGURATION: stagehand.config.ts will help you configure Stagehand
 *
 * 📝 Check out our docs for more fun use cases, like building agents
 * https://docs.stagehand.dev/
 *
 * 💬 If you have any feedback, reach out to us on Slack!
 * https://stagehand.dev/slack
 *
 * 📚 You might also benefit from the docs for Zod, Browserbase, and Playwright:
 * - https://zod.dev/
 * - https://docs.browserbase.com/
 * - https://playwright.dev/docs/intro
 */
async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  
  // whether there is a target url in environment or passed through as one of the argument in the prompt
  const targetUrl = process.env.TARGET_URL || process.argv[2];
  
  try {
    // Report progress
    await reportProgress('Attempting to navigate to the target URL');
    
    // Navigate to the provided URL with error handling
    const response = await page.goto(targetUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    if (!response) {
      await reportError('NETWORK_ERROR', 'No response received from the server', targetUrl);
      return;
    }
    
    if (!response.ok()) {
      const statusCode = response.status();
      await reportError('HTTP_ERROR', `HTTP ${statusCode} error`, targetUrl, statusCode);
      return;
    }
    
    // Report successful connection
    await reportSuccess(targetUrl);
    
    // Use act() to take actions on the page
    await reportProgress('Starting automated interactions');
    await page.act("Click the search box");

    // Use observe() to plan an action before doing it
    const [action] = await page.observe(
      "Type 'Tell me in one sentence why I should use Stagehand' into the search box",
    );
    await drawObserveOverlay(page, [action]); // Highlight the search box
    await page.waitForTimeout(1_000);
    await clearOverlays(page); // Remove the highlight before typing
    await page.act(action); // Take the action

    // For more on caching, check out our docs: https://docs.stagehand.dev/examples/caching
    await page.waitForTimeout(1_000);
    await actWithCache(page, "Click the suggestion to use AI");
    await page.waitForTimeout(5_000);

    // Use extract() to extract structured data from the page
    const { text } = await page.extract({
      instruction:
        "extract the text of the AI suggestion from the search results",
      schema: z.object({
        text: z.string(),
      }),
    });
    stagehand.log({
      category: "create-browser-app",
      message: `Got AI Suggestion`,
      auxiliary: {
        text: {
          value: text,
          type: "string",
        },
      },
    });
    stagehand.log({
      category: "create-browser-app",
      message: `Metrics`,
      auxiliary: {
        metrics: {
          value: JSON.stringify(stagehand.metrics),
          type: "object",
        },
      },
    });
    
    // Report final success with metrics
    await reportSuccess(targetUrl, stagehand.metrics);
    
  } catch (error: any) {
    // Handle different types of errors
    let errorType = 'UNKNOWN_ERROR';
    let errorMessage = error.message || 'Unknown error occurred';
    
    if (error.message?.includes('net::ERR_CONNECTION_REFUSED')) {
      errorType = 'NETWORK_ERROR';
      errorMessage = 'Connection refused - the server is not running or not accessible';
    } else if (error.message?.includes('net::ERR_NAME_NOT_RESOLVED')) {
      errorType = 'DNS_ERROR';
      errorMessage = 'Could not resolve hostname';
    } else if (error.message?.includes('net::ERR_CERT_AUTHORITY_INVALID') || 
               error.message?.includes('net::ERR_CERT_INVALID')) {
      errorType = 'SSL_ERROR';
      errorMessage = 'SSL certificate error';
    } else if (error.message?.includes('Timeout')) {
      errorType = 'TIMEOUT_ERROR';
      errorMessage = 'Request timed out';
    } else if (error.message?.includes('net::ERR_FAILED')) {
      errorType = 'BROWSER_ERROR';
      errorMessage = 'Browser failed to load the page';
    }
    
    await reportError(errorType, errorMessage, targetUrl);
    throw error; // Re-throw to maintain original error handling
  }
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
async function run(targetUrl?: string) {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack",
    )}\n`,
  );
}

// Check if TARGET_URL is provided via environment variable
const targetUrl = process.env.TARGET_URL || process.argv[2];
run(targetUrl);
