const { LLMClient } = require('../tools/llmClient');

const client = new LLMClient();

/**
 * Attempt to repair a failing shell command by asking the model for a corrected command.
 *
 * This is used when a generated command fails at runtime (non-zero exit code).
 * The model is given the original command, the error output, and a short description of the failure.
 */
async function repairCommand({ command, errorMessage, stderr, stdout, platform, shell, query }) {
  const prompt = `You are a helpful assistant that corrects a shell command when it fails to run.

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
    const raw = await client.generate({
      model: 'mistral:latest',
      prompt,
      maxTokens: 150,
    });

    const normalized = raw.replace(/\r?\n+/g, ' ').trim();
    return normalized;
  } catch (err) {
    // If the model fails, just return the original command to avoid losing the output.
    return command;
  }
}

module.exports = {
  repairCommand,
};
