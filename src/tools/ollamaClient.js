const { execFile } = require('child_process');

/**
 * Minimal wrapper around the Ollama CLI.
 *
 * Requires `ollama` to be installed and available in PATH.
 */

class OllamaClient {
  constructor(options = {}) {
    // Allow overriding the model via environment variable for convenience.
    // Example: OLLAMA_MODEL=mistral:latest
    this.model =
      options.model ||
      process.env.OLLAMA_MODEL ||
      'mistral:latest';
    // When using Ollama, you can set a default model by adding `model`.
  }

  async generate({ model, prompt, maxTokens = 200 }) {
    const chosenModel = model || this.model;
    const debug = !!process.env.AI_CMD_DEBUG;

    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[ai-cmd] OllamaClient: running model=${chosenModel} maxTokens=${maxTokens}`);
      // eslint-disable-next-line no-console
      console.log(`[ai-cmd] OllamaClient: prompt=\n${prompt}\n`);
    }

    // Try to use Ollama if available; if not, fall back to a simple heuristic response.
    try {
      const output = await this._runOllama(chosenModel, prompt, maxTokens);
      if (debug) {
        // eslint-disable-next-line no-console
        console.log(`[ai-cmd] OllamaClient: raw output=\n${output}\n`);
      }

      if (output && output.trim()) {
        return output.trim();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[ai-cmd] Ollama unavailable or failed; using local fallback.', err.message);
    }

    return this._heuristicResponse(prompt);
  }

  _runOllama(model, prompt, maxTokens) {
    return new Promise((resolve, reject) => {
      const child = execFile(
        'ollama',
        ['run', model, prompt],
        {
          shell: true,
          maxBuffer: 10 * 1024 * 1024,
        },
        (err, stdout, stderr) => {
          if (err) {
            const message = stderr ? stderr.toString() : err.message;
            return reject(new Error(`Ollama error: ${message}`));
          }

          resolve(stdout.toString().trim());
        }
      );

      if (child.stdin) {
        child.stdin.end(prompt);
      }
    });
  }

  _heuristicResponse(prompt) {
    // Very simple, deterministic heuristics when Ollama is not installed.
    // This is not a replacement for a real LLM, but it helps the tool run in a pinch.
    const lower = prompt.toLowerCase();

    if (lower.includes('extract a short intent') || lower.includes('provide a single intent')) {
      // Intent extractor fallback
      const match = lower.match(/user request:\s*"([^"]+)"/i);
      const text = match ? match[1] : '';
      const intent = text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      return JSON.stringify({ intent: intent || 'unknown', context: text || '' });
    }

    if (lower.includes('produce a single shell command') || lower.includes('only output the command')) {
      // Command generation fallback: naive mapping for some known phrases.
      const isWindows = process.platform === 'win32';

      if (lower.includes('find') && lower.includes('large')) {
        if (isWindows) {
          return 'powershell -Command "Get-ChildItem -Recurse -File | Where-Object { $_.Length -gt 100MB }"';
        }
        return 'find . -type f -size +100M';
      }

      if (lower.includes('kill') && lower.includes('port')) {
        const portMatch = prompt.match(/port\s*(\d+)/);
        const port = portMatch ? portMatch[1] : '3000';

        if (isWindows) {
          return `netstat -ano | findstr :${port}`;
        }
        return `lsof -ti :${port} | xargs kill -9`;
      }

      if (lower.includes('docker') && lower.includes('prune')) {
        return 'docker container prune';
      }

      return 'echo "(unable to generate command; install ollama for better results)"';
    }

    if (lower.includes('explain a shell command') || lower.includes('explains a shell command')) {
      const match = prompt.match(/command:\s*(.+)/i);
      const cmd = match ? match[1].trim() : '';
      if (cmd.includes('find')) {
        return 'Searches files (possibly with filters).';
      }
      if (cmd.includes('lsof')) {
        return 'Lists processes matching a criteria, such as a port.';
      }
      return `Runs: ${cmd}`;
    }

    return '(no response available)';
  }
}

module.exports = {
  OllamaClient,
};
