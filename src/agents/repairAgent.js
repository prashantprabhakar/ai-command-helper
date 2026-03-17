/**
 * Attempt to repair a failing shell command by asking the model for a corrected command.
 *
 * This is used when a generated command fails at runtime (non-zero exit code).
 * The model is given the original command, the error output, and a short description of the failure.
 */
function _looksLikeCommand(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Naive heuristic: commands typically start with a word and may contain
  // pipes/redirects/etc. If it looks like a sentence, we reject.
  const firstWord = trimmed.split(/\s+/)[0];
  if (!/^[a-zA-Z0-9._-]+$/.test(firstWord)) return false;

  const proseIndicators = ['this', 'the', 'a', 'an', 'it', 'should', 'will', 'option', 'command'];
  const lower = trimmed.toLowerCase();
  if (proseIndicators.some((w) => lower.startsWith(`${w} `))) return false;

  return true;
}

function _extractCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const firstLine = text.split(/\r?\n/)[0].trim();
  if (!firstLine) return null;

  // Remove obvious explanation tails that start with common phrases.
  const stopPatterns = [
    /\s+This command\b/i,
    /\s+This gives\b/i,
    /\s+Use\b/i,
    /\s+It\b/i,
    /\s+The\b/i,
    /\s+-\s+/,
  ];

  for (const pat of stopPatterns) {
    const match = firstLine.match(pat);
    if (match && typeof match.index === 'number') {
      return firstLine.slice(0, match.index).trim();
    }
  }

  return firstLine;
}
async function repairCommand({ client, command, errorMessage, stderr, stdout, platform, shell, query }) {
  const isMissingCommand = !command || !command.trim();

  const prompt = isMissingCommand
    ? `You are a helpful assistant that generates a shell command based on the user request.

Target platform: ${platform}
Shell: ${shell || 'unknown'}
User request: ${query}

Only output a single shell command. Do NOT output any explanation, prose, or comments.
`
    : `You are a helpful assistant that corrects a shell command when it fails to run.

Original command:
${command}

Target platform: ${platform}
Shell: ${shell || 'unknown'}
User request: ${query}

Error message:
${errorMessage}

stderr:
${stderr || '(none)'}

stdout:
${stdout || '(none)'}

Provide a fixed command that is likely to work on this platform and shell. ONLY output the command, nothing else.
`;

  try {
    const raw = await client.generate({ prompt, maxTokens: 150 });

    if (!raw) return null;

    const cleaned = raw
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .trim();

    const normalized = cleaned.replace(/\r?\n+/g, ' ').trim();

    const extracted = _extractCommand(normalized);
    if (!extracted) return null;

    const candidate = extracted.trim();

    if (candidate === command) return null;

    if (_looksLikeCommand(candidate)) {
      return candidate;
    }

    return null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  repairCommand,
};