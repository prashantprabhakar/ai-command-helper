const { executeCommand } = require('../tools/executeCommand');
const { repairCommand } = require('./repairAgent');

/**
 * Executes the generated command and attempts to repair it on failure.
 *
 * State inputs:
 * - command
 * - shell
 * - runCommand (boolean)
 * - platform
 * - query
 *
 * Adds to state:
 * - stdout, stderr, executedCommand, executedSuccessfully
 */
async function runAgent(state) {
  const { command, shell, runCommand, platform, query } = state;
  const debug = !!process.env.AI_CMD_DEBUG;

  if (!runCommand) {
    return { ...state, executedSuccessfully: false, executedCommand: null, stdout: '', stderr: '' };
  }

  const maxAttempts = 3;
  let attempts = 0;
  let currentCommand = command ? command.trim() : '';
  let lastExec = { error: new Error('No command generated'), stdout: '', stderr: '' };

  while (attempts < maxAttempts) {
    attempts += 1;

    if (!currentCommand) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log(`[ai-cmd] attempt ${attempts}/${maxAttempts}: no command generated, attempting repair`);
      }
    } else if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[ai-cmd] attempt ${attempts}/${maxAttempts}: executing command`);
    }

    if (currentCommand) {
      lastExec = await executeCommand(currentCommand, { shell });
    }

    if (!lastExec.error) {
      return {
        ...state,
        executedSuccessfully: true,
        executedCommand: currentCommand,
        stdout: lastExec.stdout,
        stderr: lastExec.stderr,
        attempts,
      };
    }

    const repaired = await repairCommand({
      command: currentCommand,
      errorMessage: lastExec.error?.message || 'Failed to generate or execute command',
      stderr: lastExec.stderr,
      stdout: lastExec.stdout,
      platform,
      shell,
      query,
    });

    const repairedCommand = (repaired || '').trim();
    if (!repairedCommand || repairedCommand === currentCommand) {
      break;
    }

    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[ai-cmd] attempt ${attempts}/${maxAttempts}: repaired command suggested: ${repairedCommand}`);
    }

    currentCommand = repairedCommand;
  }

  return {
    ...state,
    executedSuccessfully: false,
    executedCommand: currentCommand,
    stdout: lastExec.stdout,
    stderr: lastExec.stderr,
    errorMessage: `Unable to execute command after ${attempts} attempt(s).`,
    attempts,
  };
}

module.exports = {
  runAgent,
};
