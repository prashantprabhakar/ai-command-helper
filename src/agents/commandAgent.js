const { LLMClient } = require('../tools/llmClient');

const client = new LLMClient();

/**
 * Generate a shell command from an intent and the user's description.
 */
function _looksLikeCommand(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  const lower = trimmed.toLowerCase();
  if (lower.includes('command:') || lower.includes('explanation:')) return false;
  if (/\b(the|a|an)\b/.test(lower) && lower.split(' ').length > 8) return false;

  const cmdKeywords = ['ls', 'find', 'grep', 'docker', 'ps', 'netstat', 'lsof', 'kill', 'cat', 'echo', 'powershell', 'bash', 'sh', 'curl', 'wget'];
  if (cmdKeywords.some((k) => lower.startsWith(k) || lower.includes(` ${k}`))) return true;

  const cmdChars = ['|', ';', '&&', '||', '>', '<', '$', '*', '/', '\\'];
  if (cmdChars.some((c) => trimmed.includes(c))) return true;

  return false;
}

function _hasUnmatchedQuotes(text) {
  const quoteChars = [`\"`, `\'`];
  for (const q of quoteChars) {
    const count = (text.match(new RegExp(q, 'g')) || []).length;
    if (count % 2 !== 0) return true;
  }
  return false;
}

function _fallbackCommand({ query, platform, shell }) {
  const lower = query.toLowerCase();
  const isWin = platform === 'win32';
  const isBash = shell && shell.toLowerCase().includes('bash');

  if (lower.includes('find') && lower.includes('large')) {
    if (isWin && isBash) {
      return 'find . -type f -size +100M';
    }
    if (isWin) {
      return 'powershell -Command "Get-ChildItem -Recurse -File | Where-Object { $_.Length -gt 100MB }"';
    }
    return 'find . -type f -size +100M';
  }

  if (lower.includes('kill') && lower.includes('port')) {
    const portMatch = query.match(/port\s*(\d+)/);
    const port = portMatch ? portMatch[1] : '3000';

    if (isWin) {
      // Prefer PowerShell cmdlets on Windows, fallback to netstat if in bash-like shell.
      if (isBash) {
        return `netstat -ano | find \"${port}\" | findstr /i \"tcp\"`;
      }
      return `powershell -Command \"Get-NetTCPConnection -LocalPort ${port} | ForEach-Object { Get-Process -Id $_.OwningProcess }\"`;
    }

    return `lsof -ti :${port} | xargs kill -9`;
  }

  if (lower.includes('docker') && lower.includes('prune')) {
    return 'docker container prune';
  }

  return 'echo "(unable to generate command; install ollama for better results)"';
}

/**
 * Generate a shell command from an intent and the user's description.
 */
async function generateCommand({ intent, query, context, platform, shell }) {
  const prompt = `You are a helpful assistant that produces a single shell command (no explanation) based on the user's intent.

Operating System: ${platform}
Shell: ${shell || 'unknown'}
User intent: ${intent}
User request: "${query}"
Context: "${context}"

Only output the command. Do NOT output any prose.
`;

  const raw = await client.generate({
    model: 'mistral',
    prompt,
    maxTokens: 180,
  });

  // Normalize output (flatten newlines into spaces) so we don't end up with truncated/partial shell commands.
  const normalized = raw.replace(/\r?\n+/g, ' ').trim();
  let command = normalized;

  if (_hasUnmatchedQuotes(command) || !_looksLikeCommand(command)) {
    // If the LLM output doesn't look like a shell command or has unbalanced quotes,
    // fall back to a small rule-based mapper.
    command = _fallbackCommand({ query, platform, shell });
  }

  return { command };
}

module.exports = {
  generateCommand,
};
