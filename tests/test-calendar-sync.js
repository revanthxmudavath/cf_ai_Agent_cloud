/**
 * Test calendar sync by creating a task with a due date
 * This should trigger the automatic calendar sync
 */

const WebSocket = require('ws');
const crypto = require('crypto');

const userId = crypto.randomUUID();
const ws = new WebSocket(`ws://localhost:8787/ws?userId=${userId}`);

console.log('🧪 Testing Calendar Sync\n');
console.log('=' .repeat(60));

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  console.log(`User ID: ${userId}\n`);

  // Create a task with a due date (tomorrow at 3pm)
  const tomorrow = Date.now() + (24 * 60 * 60 * 1000);

  const toolCall = {
    tool: 'createTask',
    params: {
      title: 'Test calendar sync',
      description: 'Testing automatic calendar sync',
      dueDate: tomorrow,
      priority: 'medium'
    }
  };

  console.log('📤 Sending tool call to create task with due date...');
  console.log(JSON.stringify(toolCall, null, 2));

  ws.send(JSON.stringify({
    type: 'tool_call',
    content: JSON.stringify(toolCall)
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('\n📥 Received message:');
    console.log(`Type: ${message.type}`);

    if (message.type === 'confirmation_request') {
      console.log('\n✅ Confirmation request received');
      console.log('Approving tool execution...');

      ws.send(JSON.stringify({
        type: 'confirmation_response',
        requestId: message.requestId,
        approved: true
      }));
    }

    if (message.type === 'tool_execution_result') {
      console.log('\n📊 Tool Execution Result:');
      console.log(JSON.stringify(message, null, 2));

      if (message.payload.success) {
        console.log('\n✅ Task created successfully!');
        console.log('📅 Now check the console for calendar sync logs...');
        console.log('Look for "[Calendar Sync]" messages in the backend');
      } else {
        console.log('\n❌ Task creation failed:');
        console.log(message.payload.error);
      }

      setTimeout(() => {
        console.log('\n🛑 Test complete. Closing connection...');
        ws.close();
        process.exit(0);
      }, 3000);
    }

  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 WebSocket connection closed');
});
