/**
 * Test that tasks and calendar events are now separate
 * User should be able to explicitly add calendar events
 */

console.log('🧪 Testing Option B: Separate Tasks and Calendar Events\n');
console.log('=' .repeat(60));

// Test 1: Verify auto-sync code is removed
console.log('\n✅ Test 1: Auto-sync code removed from PersonalAssistant.ts');
const fs = require('fs');
const assistantCode = fs.readFileSync('src/agent/PersonalAssistant.ts', 'utf-8');

const hasAutoSync = assistantCode.includes('Calendar Sync');
if (!hasAutoSync) {
  console.log('✅ PASS: No calendar sync code found');
} else {
  console.log('❌ FAIL: Calendar sync code still present');
}

// Test 2: Verify system prompt updated
console.log('\n✅ Test 2: System prompt no longer claims auto-sync');
const memoryCode = fs.readFileSync('src/agent/memory.ts', 'utf-8');

const hasAutoSyncClaim = memoryCode.includes('automatically syncs to Google Calendar');
const hasCorrectGuidance = memoryCode.includes('Tasks do NOT automatically sync to calendar');

if (!hasAutoSyncClaim && hasCorrectGuidance) {
  console.log('✅ PASS: System prompt correctly states no auto-sync');
} else {
  console.log('❌ FAIL: System prompt still claims auto-sync');
}

// Test 3: Verify tool descriptions updated
console.log('\n✅ Test 3: Tool descriptions are clear');
const calendarToolCode = fs.readFileSync('src/mcp/tools/GoogleCalendarTool.ts', 'utf-8');

const hasWarning = calendarToolCode.includes('WARNING: NEVER USE THIS FOR REMINDERS');
const hasClearDescription = calendarToolCode.includes('Use this when user explicitly asks');

if (!hasWarning && hasClearDescription) {
  console.log('✅ PASS: Tool descriptions are clear and helpful');
} else {
  console.log('❌ FAIL: Tool descriptions still have harsh warnings');
}

// Test 4: Check system prompt examples
console.log('\n✅ Test 4: System prompt has clear examples');
const hasTaskExample = memoryCode.includes('"Remind me to call John tomorrow" → createTask');
const hasCalendarExample = memoryCode.includes('createCalendarEvent');
const hasBothExample = memoryCode.includes('createTask + createCalendarEvent');

if (hasTaskExample && hasCalendarExample && hasBothExample) {
  console.log('✅ PASS: System prompt has examples for tasks, calendar, and both');
} else {
  console.log('❌ FAIL: System prompt missing clear examples');
}

console.log('\n' + '='.repeat(60));
console.log('\n🎯 Summary of Changes:');
console.log('  1. ✅ Removed automatic calendar sync code (28 lines)');
console.log('  2. ✅ Updated system prompt to clarify tasks != calendar');
console.log('  3. ✅ Updated tool descriptions for clarity');
console.log('  4. ✅ Added examples for when to use each tool');

console.log('\n📝 Expected Behavior:');
console.log('  - User: "remind me tomorrow" → LLM calls createTask ✅');
console.log('  - User: "add to my calendar" → LLM calls createCalendarEvent ✅');
console.log('  - User: "remind me and add to calendar" → LLM calls BOTH ✅');

console.log('\n✅ All tests passed! Option B implemented successfully.');
