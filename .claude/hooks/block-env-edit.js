// PreToolUse hook: Block edits to .env files
const input = JSON.parse(process.env.TOOL_INPUT || '{}');
const filePath = input.file_path || '';
if (/\.env($|\.)/.test(filePath)) {
  console.error('BLOCKED: Cannot edit .env files — they contain secrets.');
  process.exit(2);
}
