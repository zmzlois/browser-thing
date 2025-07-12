# BrowserThing CLI

This CLI tool allows you to easily test your frontend application using Stagehand's browser automation capabilities.

## Usage

1. **Start your frontend application** (e.g., `npm run dev` for a React app on localhost:3000)

2. **Run the CLI** from the project root:
   ```bash
   bun run cli
   ```

3. **Follow the prompts**:
   - Enter the URL of your application (e.g., `http://localhost:3000`)
   - Select your preferred AI tool (Cursor, Claude, or Amp)

4. **Watch the magic happen**! The CLI will:
   - Launch a browser using Stagehand
   - Navigate to your specified URL
   - Run automated tests and interactions
   - Provide feedback on the results

## How it works

The CLI exports reusable functions that can be used by other parts of your application:

### **Core Exports:**

1. **`collectUserInput()`**: Non-blocking function that collects URL and AI tool preferences
2. **`launchStagehand(userInput, serverPort?)`**: Launches browser testing with optional server integration
3. **`BrowserThingServer`**: Server class that hosts both MCP and error handling endpoints

### **Architecture:**

1. **CLI (`./cli/index.ts`)**:
   - Exports reusable functions for user input collection
   - Provides server integration capabilities
   - Can be imported and used by other modules

2. **Server (`./cli/server.ts`)**:
   - Hosts MCP server for AI tool integration
   - Provides error handling endpoints for Stagehand communication
   - Can be used independently or with CLI functions

3. **MCP Server (`./mcp/index.ts`)**:
   - Uses exported CLI functions for user input
   - Provides browser inspection tools (console logs, network requests, element inspection)
   - Can start browser testing sessions

### **Usage Patterns:**

- **Standalone CLI**: `bun run cli` - Traditional CLI experience
- **MCP Server**: `bun run mcp:dev` - MCP server with CLI integration
- **Programmatic**: Import functions and use in your own code

The system provides intelligent error handling for common issues like network errors, DNS errors, SSL issues, HTTP errors, timeouts, and browser errors.

## Example

### Successful Test
```bash
$ bun run cli

Test your frontend application with BrowserThing!!

What's the opened port you'd like us to inspect?
> http://localhost:3000

Which AI tool do you use?
> Cursor

🚀 MCP Server available at: http://localhost:12345/mcp
📡 CLI Server available at: http://localhost:12345
Starting browser test...
✅ Successfully connected to: http://localhost:3000
🔄 Starting automated interactions
📊 Test metrics: { actions: 3, duration: 15000ms }
Browser test completed successfully! 🎉
```

### Error Handling Example
```bash
$ bun run cli

What's the opened port you'd like us to inspect?
> http://localhost:9999

Which AI tool do you use?
> Claude

Starting browser test...

❌ Network Error
Could not connect to: http://localhost:9999
Please check if your application is running and the URL is correct.

💡 Troubleshooting tips:
   • Make sure your application is running
   • Check if the port number is correct
   • Verify the URL starts with http:// or https://
   • Try accessing the URL directly in your browser
   • Check for any firewall or network restrictions

Browser test failed due to URL error ❌
```

## Requirements

- Your frontend application must be running and accessible
- Valid URL starting with `http://` or `https://`
- Stagehand dependencies installed in the `stagehand/` directory
