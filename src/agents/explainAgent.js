/**
 * Generate a brief explanation for a shell command.
 */
async function generateExplanation({ client, command }) {
  const prompt = `You are a helpful assistant that explains a shell command in one or two sentences.

Command: ${command}

Explain in plain English what this command does. Keep it short and concise.
`;

  const raw = await client.generate({ prompt, maxTokens: 120 });

  return { explanation: raw.trim() };
}

module.exports = {
  generateExplanation,
};
