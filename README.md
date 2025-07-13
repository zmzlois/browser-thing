# Frontline Agent
Never “open DevTools, hunt errors” again. Your agent does it while you keep coding.

## Overview
Today’s coding agents can write code and run back-end tests, but front-end development still requires humans to open the browser, read console or network errors, and relay them back. Frontline closes the gap by providing agents with live browser context, fully closing the loop on agent-driven development.

## Features
* Real-time browser inspection and error tracing
* Auto-clicking, DOM inspection, and interaction simulation
* Validates changes against live rendered output
* Uses cloud browser instances (Chrome) for visibility

## Demo
* Video link
* Screenshots, gif 
* Example use case: A developer is working on a tooltip hover feature. Instead of opening DevTools, hovering over elements, checking event listeners, and scanning console logs manually, they describe the feature to the agent. The agent inspects the live browser context, detects that the tooltip isn’t rendering due to a missing class toggle, and suggests the fix — all without breaking the developer’s flow.

## Getting Started
You’ll need:
* Bun installed globally
* Node.js (v24+ recommended)
* Git
### 1. Clone the repo
```
bash
git clone https://github.com/zmzlois/browser-thing
cd browser-thing
```
### 2. Install dependencies 
The project uses Bun to manage dependencies. Run:  
```
bun install
```  
  
If you don't have bun, find installation instructions [here.](https://bun.sh/docs/installation)

### 3. Start Frontline
This command runs the MCP inspector agent. It connects your agent to a live Chrome browser using Playwright and opens a control interface in a new browser tab. Depending on your environment, use one or the other:  
```
bunx @modelcontextprotocol/inspector
```   
```
npx @modelcontextprotocol/inspector
```  
  
## Architecture & Tech Stack
Frontline's agent-based system connects the browser state to your code editor. Browser logs, DOM state, and interactions are then streamed to agents. 

Built with:
* Node.js (via Bun)
* Playwright for browser automation
* MCP (Model Context Protocol) for agent orchestration
* Compatible with Claude, Cursor, and other AI devtools
![System diagram](https://github.com/zmzlois/browser-thing/raw/main/diagram.png)

## Challenges
* What was hard
* What didn’t work initially
* Any tradeoffs or decisions

## What's Next
* Traces can be formatted and displayed to the end user instead of in the command line for improved transparency & visibility. For instance, a PM can track the changes being made and question the reasoning or decisions, so the trace becomes a collaboration layer, not just a backend log.
* Could create a CLI install package/tool to take care of necessary dependencies like Playwright
* Support on browsers like Safari, Edge, Firefox


---
[Made for Weavehacks 2025](https://devpost.com/software/frontline-agent)
