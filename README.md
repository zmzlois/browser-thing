# Frontline Agent
Never “open DevTools, hunt errors” again. Your agent does it while you keep coding.

[Overview](#overview)
[Inspiration](#overview)
## Overview
Today’s coding agents can write code and run back-end tests, but front-end development still requires humans to open the browser, read console or network errors, and relay them back to code editors, or other coding agents that can be run locally. Frontline closes the gap by providing agents with live browser context, fully closing the loop on agent-driven development, allowing user to extend from their current SDLC. 

## Inspiration 

Started with @Nicolapp's daily struggle from at [Convex](https://www.convex.dev/), our team decided to build a tool that can benefit ourselves in our day to day work with applications development (also accidentally finished a feature Stagehand been wanting to complete). 


## Architecture & Tech Stack

![System diagram](https://github.com/zmzlois/browser-thing/raw/main/images/architecture.png)


This application uses: 
1. [Stagehand](https://www.stagehand.dev/) by BrowserBase
2. [Weave](https://wandb.ai/site/weave/) by Weights & Bias 
    - [Weave project url](https://wandb.ai/lois-zh/frontline_mcp/weave/traces?view=traces_default)
3. Official [Module Context Protocol](https://www.npmjs.com/package/@modelcontextprotocol/sdk) for MCP server development
4. [Template by Convex](https://www.convex.dev/templates)
5. [Puppeteer](https://pptr.dev/guides/installation)
6. [Anthropic AI SDK](https://www.npmjs.com/package/@anthropic-ai/sdk)


## Features
1. An MCP server enable real-time browser inspection and error tracing for console logs and network request with Stagehand by Browserbase
2. Choose between OpenAI, Anthropic Claude and Gemini for Stagehand browser automation
3. Auto-clicking, auto-form filling, DOM inspection, and interaction simulation 
4. Validates changes within code editor against live rendered output from browser
5. Uses cloud browser instances (Chrome) for visibility (optional)
6. Cursor agent can now perform needed action to understand the source of error and recommend changes
7. Trace LLM call with Weave

![mcp-tool](https://raw.githubusercontent.com/zmzlois/browser-thing/main/images/mcp-tool.png)
![weave](https://raw.githubusercontent.com/zmzlois/browser-thing/main/images/weave-dashboard-trace.png)

## Demo

<iframe width="560" height="315" src="https://www.youtube.com/embed/SZ-4vUR6Ptc?si=OXZ9qqKyDRWr6iKq" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Challenges 

1. WE ARE NOOBs - our entire team met through OSS community, we have little prior knowledge regarding MCP so we learnt things on the fly during this hackathon 
2. Using Stagehand with a non-headless browser that is also manipulated by a human user is currently inconvenient. One reason is the lack of an option to use the OS viewport size. We end up open several PR to improve the issue. 
3. Weave's Typescript SDK doesn't support MCP server. It only supports LLM call tracing. We added Weave for [stagehand's browser automation](/mcp/utils/WeaveClient.ts) and additionally attempted to write a new typescript SDK from scratch to support complex instrumenting to include infra/system information including machine details, v8 conditions, network requests etc. 


### OSS PR opened/pending during this hackathon 
1. [Allow dynamic viewport for stagehand](https://github.com/browserbase/stagehand/pull/874)
2. [Readme improvement for stagehand](https://github.com/browserbase/stagehand/pull/873)
3. [Custom tracing typescript SDK for Weave to support protobuf conversion and MCP server, completely OTEL compliant](https://github.com/zmzlois/browser-thing/tree/main/otel)

## Getting Started
You’ll need:
* Bun installed globally

> If you don't have bun, find installation instructions [here.](https://bun.sh/docs/installation)

* Node.js (v22+ recommended)

* Git

### 1. Start the MCP server
```bash
git clone https://github.com/zmzlois/browser-thing 


## or optionally with 
npx frontline-mcp@latest
```
### 2. Clone the demo project (separate terminal)
```
git clone https://github.com/Nicolapps/browser-thing-project-demo 
cd browser-thing-project-demo
npm install
npm run dev
```

### 3. Start Frontline
This command runs the MCP inspector agent. It connects your agent to a live Chrome browser using Playwright and opens a control interface in a new browser tab. Depending on your environment, use one or the other:  


In a separate terminal: 

```
cd browser-thing 
bun run mcp:dev # start the server locally
bun run mcp:inspector
```


  


## Challenges
* What was hard
* What didn’t work initially
* Any tradeoffs or decisions



## What's Next & What can be done better 
* Finish the tracing package customised for weave so it can trace both LLM calls and MCP servers 
* Our traces don't have a stacks due to current limitation
* The unfinished CLI package should auto set up agent tooling, spin up both mcp inspector, mcp server and install package/tool to take care of necessary dependencies like Playwright
* It could be helpful to use Stagehand with non-Chromium browsers. I saw that this is not on the roadmap for now (https://github.com/browserbase/stagehand/issues/391), but as a user it’s difficult to understand why something that wraps Playwright can’t be used on all platforms that Playwright supports. 
* There’s a full API reference at https://docs.stagehand.dev/reference/introduction, but it would be even better if this documentation were embedded in the TypeScript types that are bundled with the package



---
[Made for Weavehacks 2025](https://devpost.com/software/frontline-agent)
