/**
 * Test calendar event creation with new refresh token
 */

const WebSocket = require('ws');
const crypto = require('crypto');

const token = process.env.TEST_TOKEN;
if (!token) { console.error('❌ TEST_TOKEN env variable required'); process.exit(1); }
const ws = new WebSocket(`ws://localhost:8787/ws?token=${encodeURIComponent(token)}`);

console.log('🧪 Testing Calendar Event Creation\n');
console.log('=' .repeat(60));

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  console.log(`User ID: ${userId}\n`);

  // Send a message to create a calendar event
  console.log('📤 Sending message: "add a test event to my calendar tomorrow at 3pm"');

  ws.send(JSON.stringify({
    type: 'chat',
    content: 'add a test event to my calendar tomorrow at 3pm'
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.type === 'confirmation_request') {
      console.log('\n✅ Confirmation request received');
      console.log('Tool:', message.toolCalls?.[0]?.toolName || 'unknown');
      console.log('Approving...');

      ws.send(JSON.stringify({
        type: 'confirmation_response',
        requestId: message.requestId,
        approved: true
      }));
    }

    if (message.type === 'tool_execution_result') {
      console.log('\n📊 Tool Execution Result:');
      console.log('Success:', message.payload.success);

      if (message.payload.success) {
        console.log('✅ Calendar event created successfully!');
        console.log('Event ID:', message.payload.output?.eventId);
        console.log('Summary:', message.payload.output?.summary);
        console.log('Start Time:', message.payload.output?.startTime);
        console.log('Link:', message.payload.output?.htmlLink);
      } else {
        console.log('❌ Calendar event creation failed');
        console.log('Error:', message.payload.error);
      }

      setTimeout(() => {
        console.log('\n✅ Test complete. Closing connection...');
        ws.close();
        process.exit(message.payload.success ? 0 : 1);
      }, 2000);
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
  console.log('🔌 WebSocket connection closed');
});
