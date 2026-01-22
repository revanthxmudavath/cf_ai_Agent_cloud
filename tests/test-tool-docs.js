/**
 * Test to verify the tool documentation includes proper dueDate example
 */

import { generateToolDocs } from '../src/mcp/CodeModeAPI.ts';

console.log('🧪 Testing Tool Documentation Generation\n');
console.log('=' .repeat(60));

const docs = generateToolDocs();

// Check if createTask example includes dueDate
const hasCreateTask = docs.includes('createTask');
const hasDueDate = docs.includes('dueDate');
const hasTimestamp = /dueDate":\s*\d{13}/.test(docs); // Check for 13-digit timestamp

console.log('✅ Tool documentation checks:');
console.log(`  - Contains createTask: ${hasCreateTask}`);
console.log(`  - Contains dueDate parameter: ${hasDueDate}`);
console.log(`  - Contains valid timestamp (13 digits): ${hasTimestamp}`);

if (hasCreateTask && hasDueDate && hasTimestamp) {
  console.log('\n✅ SUCCESS: createTask tool now includes dueDate example!');

  // Extract the createTask example
  const createTaskMatch = docs.match(/### createTask[\s\S]*?```json\s*([\s\S]*?)```/);
  if (createTaskMatch) {
    console.log('\n📄 Generated createTask Example:');
    console.log(createTaskMatch[1]);
  }
} else {
  console.log('\n❌ FAILED: createTask tool missing proper dueDate example');
}

console.log('\n' + '='.repeat(60));
