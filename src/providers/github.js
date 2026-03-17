/**
 * GitHub Models provider — works with a GitHub Personal Access Token (PAT).
 * Copilot Pro subscribers can use this at no extra cost.
 *
 * Env vars:
 *   GITHUB_TOKEN  — GitHub PAT with models:read permission
 *
 * Available models use GitHub model IDs such as:
 *   openai/gpt-4.1, openai/gpt-4o, openai/gpt-4o-mini,
 *   anthropic/claude-3.5-sonnet, mistral-ai/mistral-large
 * Full list: https://github.com/marketplace/models
 */

const NAME = 'github';
const DEFAULT_MODEL = 'openai/gpt-4.1';
const ENDPOINT = 'https://models.github.ai/inference/chat/completions';

const MODEL_ALIASES = new Map([
  ['gpt-4.1', 'openai/gpt-4.1'],
  ['gpt-4.1-mini', 'openai/gpt-4.1-mini'],
  ['gpt-4.1-nano', 'openai/gpt-4.1-nano'],
  ['gpt-4o', 'openai/gpt-4o'],
  ['gpt-4o-mini', 'openai/gpt-4o-mini'],
  ['claude-3-5-sonnet', 'anthropic/claude-3.5-sonnet'],
  ['claude-3.5-sonnet', 'anthropic/claude-3.5-sonnet'],
  ['mistral-large', 'mistral-ai/mistral-large'],
]);

function normalizeModelId(model) {
  const rawModel = String(model || '').trim();
  if (!rawModel) return DEFAULT_MODEL;

  if (rawModel.includes('/')) {
    return rawModel;
  }

  const withoutSnapshot = rawModel.replace(/-\d{4}-\d{2}-\d{2}$/u, '');
  return MODEL_ALIASES.get(withoutSnapshot) || withoutSnapshot;
}

function formatGitHubModelsError(status, bodyText) {
  let payload;

  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = undefined;
  }

  const message = payload?.error?.message || bodyText;
  const details = payload?.error?.details;
  const combined = [message, details].filter(Boolean).join(' ');

  if (status === 401 && /models(?:\:read)? permission is required/i.test(combined)) {
    return new Error(
      'GitHub Models authentication failed: the configured token does not have models:read permission. Create or update your GitHub PAT to include models:read, then set GITHUB_TOKEN to that token.'
    );
  }

  if (status === 400 && /unknown model/i.test(combined)) {
    return new Error(
      'GitHub Models rejected the configured model. Use a GitHub model ID like openai/gpt-4.1 or openai/gpt-4o, not an OpenAI snapshot name such as gpt-4.1-2025-04-14.'
    );
  }

  return new Error(`GitHub Models error (${status}): ${message || bodyText}`);
}

async function generate({ model, prompt, maxTokens }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is not set. Create a GitHub PAT with models:read permission and export it as GITHUB_TOKEN.'
    );
  }

  const resolvedModel = normalizeModelId(model);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw formatGitHubModelsError(res.status, await res.text());
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

module.exports = { name: NAME, defaultModel: DEFAULT_MODEL, generate };
