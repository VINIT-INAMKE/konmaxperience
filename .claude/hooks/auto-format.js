// PostToolUse hook: Auto-format TypeScript files after edit
const { execSync } = require('child_process');
const input = JSON.parse(process.env.TOOL_INPUT || '{}');
const filePath = input.file_path || '';
if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'ignore', timeout: 10000 });
  } catch (e) {
    // Non-critical — don't block on format failure
  }
}
