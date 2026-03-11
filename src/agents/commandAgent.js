const { LLMClient } = require('../tools/llmClient');

const client = new LLMClient();

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

  const cleaned = raw
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim();

  // Normalize output (flatten newlines into spaces).
  const normalized = cleaned.replace(/\r?\n+/g, ' ').trim();


  // Only filter out obvious prose/non-command text.
  if (!normalized) {
    return { command: null };
  }

  if (normalized.length > 200) {
    return { command: null };
  }

  // If the model falls back to a placeholder/error message (e.g. "unable to generate command"),
  // treat this as a generation failure so downstream logic can repair it.
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower.includes('unable to generate command') || normalizedLower.includes('install ollama')) {
    return { command: null };
  }

  // Trust the LLM and return the command as-is.
  // The repair loop will handle any execution failures.
  return { command: normalized };
}

module.exports = {
  generateCommand,
};
