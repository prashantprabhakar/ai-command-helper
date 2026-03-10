const { OllamaClient } = require('../tools/ollamaClient');

const client = new OllamaClient();

/**
 * Analyze the user's raw query to determine intent.
 * This is intentionally lightweight and uses a simple prompt.
 */
async function analyzeIntent({ query }) {
  const prompt = `You are an assistant that extracts a short intent label from a user's request.

User request: "${query}"

Provide a single intent label (snake_case) and a short context/summary. Output as JSON with keys: intent, context.
`;

  const raw = await client.generate({
    model: 'mistral',
    prompt,
    maxTokens: 150,
  });

  // Try to parse JSON from the model response.
  let intent = 'unknown';
  let context = query;

  try {
    const parsed = JSON.parse(raw);
    intent = parsed.intent || intent;
    context = parsed.context || context;
  } catch {
    // Fallback: use a simple heuristic
    intent = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    context = query;
  }

  return { intent, query, context };
}

module.exports = {
  analyzeIntent,
};
