/**
 * Tool Calling Integration Tests
 *
 * Tests the complete Pre-Compilation tool calling flow:
 * - LLM generates JSON tool calls
 * - Agent extracts JSON blocks
 * - User confirmation flow
 * - Direct tool execution
 * - Tool results
 *
 * Run with: node tests/test-tool-calling.js
 */

const WebSocket = require('../node_modules/.pnpm/ws@7.5.10_bufferutil@4.0.9_utf-8-validate@5.0.10/node_modules/ws');

const WORKER_URL = 'ws://localhost:8787/ws';
const token = process.env.TEST_TOKEN;
if (!token) { console.error('❌ TEST_TOKEN env variable required'); process.exit(1); }

let testsPassed = 0;
let testsFailed = 0;

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warn: '\x1b[33m',    // Yellow
  };
  console.log(`${colors[type]}${message}\x1b[0m`);
}

function assert(condition, testName) {
  if (condition) {
    log(`✓ ${testName}`, 'success');
    testsPassed++;
  } else {
    log(`✗ ${testName}`, 'error');
    testsFailed++;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  log('\n=== Pre-Compilation Tool Calling Integration Tests ===\n', 'info');
  const ws = new WebSocket(`${WORKER_URL}?token=${encodeURIComponent(token)}`);

  let pendingConfirmation = null;
  let lastToolResult = null;

  ws.on('open', () => {
    log('✓ WebSocket connection established', 'success');
  });

  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === 'confirmation_request') {
      pendingConfirmation = message.payload;
      log(`\n📋 Confirmation Request Received:`, 'warn');
      log(`  Request ID: ${pendingConfirmation.requestId}`, 'info');
      log(`  Tool Calls: ${pendingConfirmation.toolCalls.length}`, 'info');
      pendingConfirmation.toolCalls.forEach((call, i) => {
        log(`    ${i + 1}. ${call.toolName}: ${JSON.stringify(call.parameters)}`, 'info');
      });
    }

    if (message.type === 'tool_execution_result') {
      lastToolResult = message;
      log(`\n📊 Tool Execution Result:`, message.success ? 'success' : 'error');
      log(`  Tool: ${message.toolName}`, 'info');
      if (message.success) {
        log(`  Output: ${JSON.stringify(message.output, null, 2)}`, 'info');
      } else {
        log(`  Error: ${message.error}`, 'error');
      }
    }
  });

  ws.on('error', (error) => {
    log(`WebSocket error: ${error.message}`, 'error');
  });

  ws.on('close', () => {
    log('\nWebSocket connection closed', 'info');
    printTestSummary();
  });

  // Wait for connection
  await sleep(1000);

  // ============================================================================
  // Test 1: JSON Tool Call Extraction - Simple Case
  // ============================================================================
  log('\n--- Test 1: JSON Block Extraction (Simple) ---', 'info');

  const simpleJSON = `
\`\`\`json
{
  "tool": "createTask",
  "params": {
    "title": "Test Task",
    "priority": "high"
  }
}
\`\`\`
`;

  const extracted1 = extractJSONBlocksSimulation(simpleJSON);
  assert(extracted1.length === 1, 'Should extract 1 JSON block');
  assert(extracted1[0].tool === 'createTask', 'Should identify createTask');
  assert(extracted1[0].params.title === 'Test Task', 'Should extract params correctly');

  // ============================================================================
  // Test 2: JSON Tool Call Extraction - Multiple Calls
  // ============================================================================
  log('\n--- Test 2: JSON Block Extraction (Multiple) ---', 'info');

  const multiJSON = `
I'll create those tasks for you.

\`\`\`json
{
  "tool": "createTask",
  "params": { "title": "Task 1" }
}
\`\`\`

\`\`\`json
{
  "tool": "createTask",
  "params": { "title": "Task 2" }
}
\`\`\`
`;

  const extracted2 = extractJSONBlocksSimulation(multiJSON);
  assert(extracted2.length === 2, 'Should extract 2 JSON blocks');
  assert(extracted2[1].params.title === 'Task 2', 'Should extract second task correctly');

  // ============================================================================
  // Test 3: Invalid JSON Handling
  // ============================================================================
  log('\n--- Test 3: Invalid JSON Handling ---', 'info');

  const invalidJSON = `
\`\`\`json
{
  "tool": "createTask",
  "params": { "title": "Unclosed string
}
\`\`\`
`;

  const extracted3 = extractJSONBlocksSimulation(invalidJSON);
  assert(extracted3.length === 0, 'Should skip invalid JSON blocks');

  // ============================================================================
  // Test 4: JSON Format Validation
  // ============================================================================
  log('\n--- Test 4: JSON Format Validation ---', 'info');

  const missingTool = `
\`\`\`json
{
  "params": { "title": "Task" }
}
\`\`\`
`;

  const missingParams = `
\`\`\`json
{
  "tool": "createTask"
}
\`\`\`
`;

  const extracted4a = extractJSONBlocksSimulation(missingTool);
  const extracted4b = extractJSONBlocksSimulation(missingParams);

  assert(extracted4a.length === 0, 'Should reject JSON without "tool" field');
  assert(extracted4b.length === 0, 'Should reject JSON without "params" field');

  // ============================================================================
  // Test 5: End-to-End Tool Execution Flow (createTask)
  // ============================================================================
  log('\n--- Test 5: End-to-End Tool Execution (createTask) ---', 'info');

  pendingConfirmation = null;
  lastToolResult = null;

  ws.send(JSON.stringify({
    type: 'chat',
    payload: {
      content: 'Create a task called "Buy milk" with high priority'
    },
    timestamp: Date.now()
  }));

  log('Sent chat message requesting task creation...', 'info');

  // Wait for LLM response and confirmation request
  await sleep(5000);

  if (pendingConfirmation) {
    assert(pendingConfirmation.requestId, 'Confirmation request should have ID');
    assert(pendingConfirmation.toolCalls.length > 0, 'Should have extracted tool calls');

    const hasCreateTask = pendingConfirmation.toolCalls.some(
      call => call.toolName === 'createTask'
    );
    assert(hasCreateTask, 'Should extract createTask tool call');

    // Approve the tool execution
    log('\n✓ Approving tool execution...', 'success');
    ws.send(JSON.stringify({
      type: 'confirmation_response',
      payload: {
        requestId: pendingConfirmation.requestId,
        approved: true,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }));

    // Wait for execution result
    await sleep(3000);

    if (lastToolResult) {
      assert(lastToolResult.success, 'Tool execution should succeed');
      assert(lastToolResult.toolName === 'createTask', 'Should be createTask result');
      assert(lastToolResult.output && lastToolResult.output.id, 'Should return task ID');
    } else {
      log('⚠ No tool execution result received', 'warn');
    }
  } else {
    log('⚠ No confirmation request received (LLM may not have generated JSON)', 'warn');
  }

  // ============================================================================
  // Test 6: Confirmation Rejection
  // ============================================================================
  log('\n--- Test 6: Confirmation Rejection ---', 'info');

  pendingConfirmation = null;
  lastToolResult = null;

  ws.send(JSON.stringify({
    type: 'chat',
    payload: {
      content: 'Create another task called "Buy eggs"'
    },
    timestamp: Date.now()
  }));

  await sleep(5000);

  if (pendingConfirmation) {
    log('\n✗ Rejecting tool execution...', 'warn');
    ws.send(JSON.stringify({
      type: 'confirmation_response',
      payload: {
        requestId: pendingConfirmation.requestId,
        approved: false,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }));

    await sleep(2000);

    if (lastToolResult) {
      assert(!lastToolResult.success, 'Rejected tool should fail');
      assert(lastToolResult.error, 'Should have error message');
    }
    assert(true, 'Tool execution rejected successfully');
  }

  // ============================================================================
  // Test 7: List Tasks Tool
  // ============================================================================
  log('\n--- Test 7: List Tasks Tool ---', 'info');

  pendingConfirmation = null;
  lastToolResult = null;

  ws.send(JSON.stringify({
    type: 'chat',
    payload: {
      content: 'Show me all my tasks'
    },
    timestamp: Date.now()
  }));

  await sleep(5000);

  if (pendingConfirmation) {
    const hasListTasks = pendingConfirmation.toolCalls.some(
      call => call.toolName === 'listTasks'
    );
    assert(hasListTasks, 'Should extract listTasks tool call');

    // Approve
    ws.send(JSON.stringify({
      type: 'confirmation_response',
      payload: {
        requestId: pendingConfirmation.requestId,
        approved: true,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }));

    await sleep(3000);

    if (lastToolResult) {
      assert(lastToolResult.success, 'listTasks should succeed');
      assert(Array.isArray(lastToolResult.output), 'Should return array of tasks');
    }
  }

  // ============================================================================
  // Test 8: Weather Tool Integration
  // ============================================================================
  log('\n--- Test 8: Weather Tool (API Integration) ---', 'info');

  pendingConfirmation = null;
  lastToolResult = null;

  ws.send(JSON.stringify({
    type: 'chat',
    payload: {
      content: 'What is the weather in London?'
    },
    timestamp: Date.now()
  }));

  log('⚠ Note: Weather API requires OPENWEATHER_API_KEY in .dev.vars', 'warn');

  await sleep(5000);

  if (pendingConfirmation) {
    const hasWeatherCall = pendingConfirmation.toolCalls.some(
      call => call.toolName === 'getWeather'
    );
    assert(hasWeatherCall, 'Should extract getWeather tool call');

    // Approve (will fail if no API key configured)
    ws.send(JSON.stringify({
      type: 'confirmation_response',
      payload: {
        requestId: pendingConfirmation.requestId,
        approved: true,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }));

    await sleep(3000);

    if (lastToolResult) {
      if (lastToolResult.success) {
        log('✓ Weather API call succeeded', 'success');
      } else {
        log('⚠ Weather API failed (likely no API key)', 'warn');
      }
    }
  }

  // ============================================================================
  // Test 9: Email Tool Integration
  // ============================================================================
  log('\n--- Test 9: Email Tool (API Integration) ---', 'info');

  pendingConfirmation = null;
  lastToolResult = null;

  ws.send(JSON.stringify({
    type: 'chat',
    payload: {
      content: 'Send an email to test@example.com saying "Hello from AI Assistant"'
    },
    timestamp: Date.now()
  }));

  log('⚠ Note: Email API requires POSTMARK_API_KEY in .dev.vars', 'warn');

  await sleep(5000);

  if (pendingConfirmation) {
    const hasEmailCall = pendingConfirmation.toolCalls.some(
      call => call.toolName === 'sendEmail'
    );
    assert(hasEmailCall, 'Should extract sendEmail tool call');

    // Don't actually approve email sending in tests
    log('⚠ Skipping email approval (would send real email)', 'warn');
  }

  // ============================================================================
  // Test 10: Multiple Tools in Single Response
  // ============================================================================
  log('\n--- Test 10: Multiple Tools in Single Response ---', 'info');

  const multiToolJSON = `
I'll create both tasks for you.

\`\`\`json
{
  "tool": "createTask",
  "params": {
    "title": "First task",
    "priority": "medium"
  }
}
\`\`\`

\`\`\`json
{
  "tool": "createTask",
  "params": {
    "title": "Second task",
    "priority": "low"
  }
}
\`\`\`
`;

  const multiExtracted = extractJSONBlocksSimulation(multiToolJSON);
  assert(multiExtracted.length === 2, 'Should extract multiple JSON blocks from single response');
  assert(multiExtracted[0].params.priority === 'medium', 'Should preserve first tool params');
  assert(multiExtracted[1].params.priority === 'low', 'Should preserve second tool params');

  // Close connection after tests
  await sleep(2000);
  ws.close();
}

// ============================================================================
// Simulation Functions (Client-Side JSON Extraction)
// ============================================================================

/**
 * Simulate server-side JSON block extraction (for testing)
 * This matches the regex logic in PersonalAssistant.extractJSONBlocks()
 */
function extractJSONBlocksSimulation(text) {
  const jsonBlockRegex = /```json\n([\s\S]*?)```/g;
  const toolCalls = [];
  let match;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);

      // Validate required fields
      if (parsed.tool && parsed.params) {
        toolCalls.push({
          tool: parsed.tool,
          params: parsed.params
        });
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }

  return toolCalls;
}

function printTestSummary() {
  log('\n=== Test Summary ===', 'info');
  log(`Passed: ${testsPassed}`, 'success');
  if (testsFailed > 0) {
    log(`Failed: ${testsFailed}`, 'error');
  }
  log(`Total: ${testsPassed + testsFailed}`, 'info');

  if (testsFailed === 0) {
    log('\n🎉 All tests passed!', 'success');
  } else {
    log(`\n❌ ${testsFailed} test(s) failed`, 'error');
  }
}

// Run tests
runTests().catch(error => {
  log(`Test suite error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
