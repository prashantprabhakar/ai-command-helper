const { OllamaClient } = require('../tools/ollamaClient');

const client = new OllamaClient();

/**
 * Generate a shell command from an intent and the user's description.
 */
async function generateCommand({ intent, query, context, platform }) {
  const prompt = `You are a helpful assistant that produces a single shell command (no explanation) based on the user's intent.

Operating System: ${platform}
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

  const command = raw.trim().split('\n')[0];

  return { command };
}

module.exports = {
  generateCommand,
};
