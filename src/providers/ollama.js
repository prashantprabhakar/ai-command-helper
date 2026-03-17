const { OllamaClient } = require('../tools/ollamaClient');

const NAME = 'ollama';
const DEFAULT_MODEL = 'mistral:latest';

let _instance = null;

function _getInstance(model) {
  if (!_instance) _instance = new OllamaClient({ model });
  return _instance;
}

async function generate({ model, prompt, maxTokens }) {
  const ollama = _getInstance(model);
  try {
    return await ollama.generate({ model, prompt, maxTokens });
  } catch {
    return ollama._heuristicResponse(prompt);
  }
}

module.exports = { name: NAME, defaultModel: DEFAULT_MODEL, generate };
