const { getProvider } = require('../providers');

/**
 * LLM client — thin wrapper that delegates to the active provider.
 *
 * Provider selection (in priority order):
 *   1. options.provider passed to constructor
 *   2. AI_CLI_PROVIDER environment variable  (default: 'ollama')
 *
 * Model selection (in priority order):
 *   1. options.model passed to constructor
 *   2. AI_CLI_MODEL environment variable
 *   3. provider's own defaultModel
 *
 * To add a new provider, drop a file in src/providers/ — no edits here needed.
 */

class LLMClient {
  constructor(options = {}) {
    // Read env vars here (not at module load) so dotenv has already run in cli.js
    const providerName = (options.provider || process.env.AI_CLI_PROVIDER || 'ollama').toLowerCase();
    this._provider = getProvider(providerName);
    this.defaultModel = options.model || process.env.AI_CLI_MODEL || this._provider.defaultModel;

    console.log(`Provider: ${providerName} | model: ${this.defaultModel}`)
  }

  async generate({ prompt, maxTokens = 200 }) {
    return this._provider.generate({ model: this.defaultModel, prompt, maxTokens });
  }
}

module.exports = { LLMClient };

