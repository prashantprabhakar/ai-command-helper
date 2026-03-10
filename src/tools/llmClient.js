const { OllamaClient } = require('./ollamaClient');

/**
 * A tiny LLM client that can route requests to multiple providers.
 *
 * Supported providers:
 * - ollama (default)
 * - openai
 * - anthropic / claude
 *
 * Configuration is done via environment variables:
 * - AI_CLI_PROVIDER (ollama|openai|anthropic|claude)
 * - AI_CLI_MODEL (e.g. mistral:latest, gpt-4o, claude-3.1)
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 */

const DEFAULT_MODEL = process.env.AI_CLI_MODEL || 'mistral:latest';
const PROVIDER = (process.env.AI_CLI_PROVIDER || 'ollama').toLowerCase();

function _safeGet(obj, path, fallback) {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
}

class LLMClient {
  constructor(options = {}) {
    this.provider = options.provider || PROVIDER;
    this.defaultModel = options.model || DEFAULT_MODEL;

    // Keep a single Ollama client instance for reuse.
    if (this.provider === 'ollama') {
      this.ollama = new OllamaClient({ model: this.defaultModel });
    }
  }

  async generate({ model, prompt, maxTokens = 200 }) {
    const chosenModel = model || this.defaultModel;

    switch (this.provider) {
      case 'openai':
        return this._generateOpenAI({ model: chosenModel, prompt, maxTokens });
      case 'anthropic':
      case 'claude':
        return this._generateAnthropic({ model: chosenModel, prompt, maxTokens });
      case 'ollama':
      default:
        return this._generateOllama({ model: chosenModel, prompt, maxTokens });
    }
  }

  async _generateOllama({ model, prompt, maxTokens }) {
    // Ollama uses its own CLI; it is optional but preferred when available.
    try {
      return await this.ollama.generate({ model, prompt, maxTokens });
    } catch (err) {
      // Fallback heuristic from the Ollama client (which is embedded in that module).
      return this.ollama._heuristicResponse(prompt);
    }
  }

  async _generateOpenAI({ model, prompt, maxTokens }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${body}`);
    }

    const data = await res.json();
    return _safeGet(data, ['choices', 0, 'message', 'content'], '').trim();
  }

  async _generateAnthropic({ model, prompt, maxTokens }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    // Anthropic expects a prompt that contains both Human and Assistant markers.
    const anthropicPrompt = `\n\nHuman: ${prompt}\n\nAssistant:`;

    const payload = {
      model,
      prompt: anthropicPrompt,
      max_tokens_to_sample: maxTokens,
      stop_sequences: ['\n\nHuman:'],
    };

    const res = await fetch('https://api.anthropic.com/v1/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${body}`);
    }

    const data = await res.json();
    return _safeGet(data, ['completion'], '').trim();
  }
}

module.exports = {
  LLMClient,
};
