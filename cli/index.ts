#!/usr/bin/env node

import { TextPrompt, isCancel } from "@clack/core";
import {
  intro,
  outro,
  text,
  group,
  select,
  note,
  groupMultiselect,
  spinner,
} from "@clack/prompts";
import { cyan, bgCyan, cyanBright, red, bgRed, bgBlack, yellow } from "picocolors";
import { spawn } from "child_process";
import path from "path";
import { BrowserThingServer } from "./server.js";

// Export the server class for reuse
export { BrowserThingServer };

// Export non-blocking command functions for reuse
export interface UserInput {
  port: string;
  aiTool: string;
  browser: string;
}

export async function collectUserInput(): Promise<UserInput> {
  intro(cyanBright(`Test your frontend application with BrowserThing!!`));
  note(
    `- Understand browser context for your frontend application from the terminal\n
    - Debug your frontend application from the terminal`,
    "BrowserThing"
  );

  const port = await text({
    message: "What's the current opening port you'd like us to inspect?",
    placeholder:
      "For http://localhost:3000 type 3000 - we will open this in your selected test browser",
    validate: (value) => {
      if (!value || !Number.isInteger(Number(value))) {
        return "Please provide a valid port";
      }
    },
  });

  if (isCancel(port)) {
    outro("No port provided. Exiting...");
    process.exit(1);
  }

  const ai_tool = await select({
    message: "Which AI tool do you use?",
    options: [
      { label: "Cursor", value: "cursor" },
      { label: "Claude", value: "claude" },
      { label: "Amp", value: "amp" },
    ],
  });

  if (isCancel(ai_tool)) {
    outro("No AI tool selected. Exiting...");
    process.exit(1);
  }

  const browser = await select({
    message: "Which browser would you prefer to use?",
    options: [
      { label: "Playwright", value: "playwright" },
      { label: "Stagehand by Browserbase", value: "stagehand" },
    ],
  });


  if(isCancel(browser)) {
    outro("No browser selected. Exiting...");
    process.exit(1);
  }

  return { port, aiTool: ai_tool, browser };
}

export async function launchStagehand(userInput: UserInput, serverPort?: number) {
  const s = spinner();
  s.start('Starting browser test...');

  // Start the server if port is provided
  let server: BrowserThingServer | undefined;
  if (serverPort) {
    server = new BrowserThingServer();
    await server.start(serverPort);
    console.log(cyan(`🚀 MCP Server available at: ${server.getMcpEndpoint()}`));
    console.log(cyan(`📡 CLI Server available at: http://localhost:${serverPort}`));
  }

  // Launch Stagehand with the provided URL and server port
  const child = spawn("bun", ["start"], {
    cwd: path.join(__dirname, "..", "stagehand"),
    stdio: "inherit",
    env: {
      ...process.env,
      TARGET_URL: userInput.port,
      AI_TOOL: userInput.aiTool,
      ...(serverPort && { CLI_SERVER_PORT: serverPort.toString() }),
    },
  });

  return new Promise<number>((resolve, reject) => {
    child.on("close", (code: number | null) => {
      s.stop();
      if (code === 0) {
        outro("Browser test completed successfully! 🎉");
      } else {
        outro(`Browser test failed with code ${code} ❌`);
      }
      if (server) {
        server.stop();
      }
      resolve(code || 0);
    });

    child.on("error", (error: Error) => {
      s.stop();
      console.error(`Failed to start browser test: ${error.message}`);
      reject(error);
    });

    // Handle process termination
    const cleanup = () => {
      s.stop();
      console.log('\nReceived interrupt signal, shutting down...');
      child.kill();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}

// CLI-specific functionality
export async function runCli() {
  try {
    const userInput = await collectUserInput();
    await launchStagehand(userInput);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  runCli();
} 