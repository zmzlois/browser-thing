#!/usr/bin/env node

/**
 * Test script to demonstrate different error scenarios
 * Run this to see how the CLI handles various URL errors
 */

const { spawn } = require('child_process');
const path = require('path');

const testCases = [
  {
    name: 'Network Error (Server not running)',
    url: 'http://localhost:9999',
    expectedError: 'NETWORK_ERROR'
  },
  {
    name: 'DNS Error (Invalid hostname)',
    url: 'http://invalid-hostname-that-does-not-exist.com',
    expectedError: 'DNS_ERROR'
  },
  {
    name: 'HTTP Error (404)',
    url: 'http://httpstat.us/404',
    expectedError: 'HTTP_ERROR'
  },
  {
    name: 'HTTP Error (500)',
    url: 'http://httpstat.us/500',
    expectedError: 'HTTP_ERROR'
  },
  {
    name: 'Timeout Error (Slow server)',
    url: 'http://httpstat.us/200?sleep=35000',
    expectedError: 'TIMEOUT_ERROR'
  }
];

async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📍 URL: ${testCase.url}`);
  console.log(`🎯 Expected Error: ${testCase.expectedError}`);
  console.log('─'.repeat(60));
  
  return new Promise((resolve) => {
    const child = spawn('bun', ['run', 'cli'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: {
        ...process.env,
        // Auto-answer the prompts
        CLI_AUTO_URL: testCase.url,
        CLI_AUTO_AI_TOOL: 'cursor'
      }
    });
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      output += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      console.log(`\n✅ Test completed with exit code: ${code}`);
      resolve({ testCase, output, code });
    });
    
    // Auto-respond to prompts after a short delay
    setTimeout(() => {
      child.stdin.write(testCase.url + '\n');
      setTimeout(() => {
        child.stdin.write('cursor\n');
      }, 1000);
    }, 2000);
  });
}

async function runAllTests() {
  console.log('🚀 Starting BrowserThing Error Handling Tests\n');
  
  for (const testCase of testCases) {
    try {
      await runTest(testCase);
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`❌ Test failed: ${testCase.name}`, error);
    }
  }
  
  console.log('\n🎉 All tests completed!');
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runTest, testCases }; 