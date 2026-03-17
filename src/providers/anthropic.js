/**
 * Anthropic provider — uses the modern /v1/messages API (required for Claude 3+).
 *
 * Env vars:
 *   ANTHROPIC_API_KEY  — your Anthropic secret key
 */

const NAME = 'anthropic';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

async function generate({ model, prompt, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

module.exports = { name: NAME, defaultModel: DEFAULT_MODEL, generate };
