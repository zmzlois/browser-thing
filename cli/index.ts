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
} from "@clack/prompts";
import { cyan, bgCyan, cyanBright, red, bgRed, bgBlack } from "picocolors";

intro(cyanBright(`Test your frontend application with BrowserThing!!`));
note(
  `- Understand browser context for your frontend application from the terminal`,
  "BrowserThing"
);

const port = text({
  message: "What's the opened port you'd like us to inspect?",
  placeholder:
    "Example: http://localhost:3000 - we will open this in a test browser",
  validate: (value) => {
    if (!value || !value.startsWith("http")) {
      return "Please provide a valid URL";
    }
    return value;
  },
});

if (isCancel(port)) {
  outro("No port provided. Exiting...");
  process.exit(1);
}

const ai_tool = select({
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

// bash commands to help them set up the configuration automatically
// open the browser 