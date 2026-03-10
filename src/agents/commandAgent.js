const { LLMClient } = require('../tools/llmClient');

const client = new LLMClient();

function _isProse(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();
  
  // Flag obvious prose patterns
  if (lower.startsWith('the ') || lower.startsWith('this ') || lower.startsWith('it ')) return true;
  if (lower.includes('explanation:') || lower.includes('command:')) return true;
  if (lower.startsWith('use ') && !lower.includes('|') && !lower.includes(';')) return true;
  
  return false;
}

/**
 * Generate a shell command from an intent and the user's description.
 * 
 * Strategy: Trust the LLM output by default. Only return null if:
 * - Output is empty
 * - Output is clearly prose (explanation/introduction)
 * 
 * Any other output (even if it looks strange) will be attempted and
 * repaired by downstream retry logic if it fails.
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

  // Normalize output (flatten newlines into spaces).
  const normalized = raw.replace(/\r?\n+/g, ' ').trim();

  // Only filter out obvious prose/non-command text.
  if (!normalized || _isProse(normalized)) {
    return { command: null };
  }

  // Trust the LLM and return the command as-is.
  // The repair loop will handle any execution failures.
  return { command: normalized };
}

module.exports = {
  generateCommand,
};
