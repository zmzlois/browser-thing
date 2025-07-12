#!/usr/bin/env node
// TODO: delete this 
/**
 * Example showing how to use the exported CLI functions
 * This demonstrates how you can use the CLI functionality in other parts of your application
 */

import { collectUserInput, launchStagehand, BrowserThingServer } from './index.js';

async function exampleUsage() {
  console.log('🎯 Example: Using exported CLI functions\n');

  // Example 1: Collect user input and launch Stagehand
  console.log('1️⃣ Collecting user input...');
  try {
    const userInput = await collectUserInput();
    console.log(`✅ Collected input: ${userInput.port}, AI Tool: ${userInput.aiTool}`);
    
    // Launch Stagehand with the collected input
    console.log('2️⃣ Launching Stagehand...');
    await launchStagehand(userInput);
  } catch (error) {
    console.error('❌ Error in example:', error);
  }
}

async function exampleWithServer() {
  console.log('\n🎯 Example: Using server with user input\n');

  // Example 2: Start server and collect input
  const server = new BrowserThingServer();
  const port = await server.start(4001);
  
  console.log(`🚀 Server started on port ${port}`);
  console.log(`📡 MCP endpoint: ${server.getMcpEndpoint()}`);
  console.log(`💚 Health check: ${server.getHealthEndpoint()}`);

  // Collect user input (this will block until user provides input)
  console.log('\n3️⃣ Collecting user input...');
  try {
    const userInput = await collectUserInput();
    console.log(`✅ Collected input: ${userInput.port}, AI Tool: ${userInput.aiTool}`);
    
    // Launch Stagehand with server integration
    console.log('4️⃣ Launching Stagehand with server...');
    await launchStagehand(userInput, port);
  } catch (error) {
    console.error('❌ Error in server example:', error);
  } finally {
    server.stop();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('🚀 BrowserThing CLI Examples\n');
  
  // Uncomment the example you want to run:
  
  // Example 1: Basic usage
  // exampleUsage();
  
  // Example 2: With server integration
  exampleWithServer();
}

export { exampleUsage, exampleWithServer }; 