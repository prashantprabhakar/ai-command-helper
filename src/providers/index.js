/**
 * Provider registry — auto-discovers every *.js file in this directory
 * (except index.js itself) and registers it by its exported `name`.
 *
 * To add a new provider, drop a new file here that exports:
 *   { name: string, defaultModel: string, generate(({ model, prompt, maxTokens }) => string) }
 *
 * Zero edits to any other file required.
 */

const fs = require('fs');
const path = require('path');

const registry = new Map();

for (const file of fs.readdirSync(__dirname)) {
  if (file === 'index.js' || !file.endsWith('.js')) continue;
  const provider = require(path.join(__dirname, file));
  registry.set(provider.name, provider);
}

function getProvider(name) {
  const provider = registry.get(name);
  if (!provider) {
    const available = [...registry.keys()].join(', ');
    throw new Error(`Unknown provider "${name}". Available: ${available}`);
  }
  return provider;
}

module.exports = { getProvider, registry };
