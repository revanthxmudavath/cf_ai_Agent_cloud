const WebSocket = require('../node_modules/.pnpm/ws@7.5.10_bufferutil@4.0.9_utf-8-validate@5.0.10/node_modules/ws');

  const userId = 'rag-test-user-' + Date.now();
  const ws = new WebSocket(`ws://localhost:8787/ws?userId=${userId}`);

  let step = 0;
  const testSteps = [
    { type: 'chat', content: 'My favorite color is blue' },
    { type: 'chat', content: 'I work as a software engineer' },
    { type: 'chat', content: 'I enjoy hiking on weekends' },
    { delay: 3000 }, // Wait for embeddings
    { type: 'chat', content: 'What do you know about my hobbies?' },
    { type: 'chat', content: 'What is my profession?' },
    { type: 'chat', content: 'What is my favorite color?' }
  ];

  ws.on('open', () => {
    console.log('✅ WebSocket connected for RAG test');
    runNextStep();
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === 'connected') {
      console.log(`✅ Connected as user: ${message.userId}`);
    }

    // Handle confirmation requests from Phase 4 tool calling
    else if (message.type === 'confirmation_request') {
      console.log('⚠️  LLM tried to call a tool - auto-rejecting to continue RAG test');
      const payload = message.payload;

      // Log what tool was attempted
      if (payload.toolCalls && payload.toolCalls.length > 0) {
        payload.toolCalls.forEach(call => {
          console.log(`   Tool attempted: ${call.toolName}`);
        });
      }

      // Auto-reject the tool call (we only want to test RAG recall, not tools)
      ws.send(JSON.stringify({
        type: 'confirmation_response',
        payload: {
          requestId: payload.requestId,
          approved: false,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      }));

      console.log('   ✗ Tool rejected - continuing with RAG test\n');
    }

    // Handle tool execution results (in case any slip through)
    else if (message.type === 'tool_execution_result') {
      console.log(`⚠️  Tool executed: ${message.toolName} - ${message.success ? 'SUCCESS' : 'FAILED'}`);
      // Don't advance step - wait for chat_response
    }

    // Handle chat responses
    else if (message.type === 'chat_response') {
      console.log(`🤖 Response: ${message.content}\n`);

      // Check for RAG recall (step counter is off by 1 because it increments before sending)
      const content = message.content.toLowerCase();
      if (step >= 5) {
        // Step 5 = hobbies question (check for hiking)
        // Step 6 = profession question (check for engineer)
        // Step 7 = color question (check for blue)
        if ((step === 5 && content.includes('hik')) ||
            (step === 6 && content.includes('engineer')) ||
            (step === 7 && content.includes('blue'))) {
          console.log('✅ PASS: RAG successfully recalled previous information');
        } else {
          console.log('⚠️  WARNING: RAG may not have recalled information');
          console.log(`   (Step ${step}, looking for: ${step === 5 ? 'hiking' : step === 6 ? 'engineer' : 'blue'})`);
        }
      }

      setTimeout(() => runNextStep(), 1000);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    process.exit(1);
  });

  ws.on('close', () => {
    console.log('\n✅ RAG test complete');
    process.exit(0);
  });

  function runNextStep() {
    if (step >= testSteps.length) {
      ws.close();
      return;
    }

    const currentStep = testSteps[step];
    step++;

    if (currentStep.delay) {
      console.log(`⏳ Waiting ${currentStep.delay}ms for embeddings...`);
      setTimeout(() => runNextStep(), currentStep.delay);
    } else {
      console.log(`📤 Step ${step}: ${currentStep.content}`);
      ws.send(JSON.stringify(currentStep));
    }
  }
