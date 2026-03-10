const { executeCommand } = require('../tools/executeCommand');
const { repairCommand } = require('./repairAgent');
const { askYesNo } = require('../tools/prompt');

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

  if (!runCommand) {
    return { ...state, executedSuccessfully: false, executedCommand: null, stdout: '', stderr: '' };
  }

  // If the command is empty, bail early.
  if (!command || !command.trim()) {
    return { ...state, executedSuccessfully: false, executedCommand: command, stdout: '', stderr: '' };
  }

  const execResult = await executeCommand(command, { shell });
  if (!execResult.error) {
    return {
      ...state,
      executedSuccessfully: true,
      executedCommand: command,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
    };
  }

  // Attempt a repair pass.
  const repaired = await repairCommand({
    command,
    errorMessage: execResult.error.message,
    stderr: execResult.stderr,
    stdout: execResult.stdout,
    platform,
    shell,
    query,
  });

  const repairedCommand = (repaired || '').trim();
  if (!repairedCommand || repairedCommand === command) {
    return {
      ...state,
      executedSuccessfully: false,
      executedCommand: command,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      errorMessage: execResult.error?.message,
      repaired: false,
    };
  }

  console.log('\n[ai-cmd] Repaired command suggestion:');
  console.log(repairedCommand);

  const shouldRunRepaired = await askYesNo('\nRun repaired command? (y/n) ');
  if (!shouldRunRepaired) {
    return {
      ...state,
      executedSuccessfully: false,
      executedCommand: command,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
    };
  }

  const secondTry = await executeCommand(repairedCommand, { shell });
  return {
    ...state,
    executedSuccessfully: !secondTry.error,
    executedCommand: repairedCommand,
    stdout: secondTry.stdout,
    stderr: secondTry.stderr,
    errorMessage: secondTry.error?.message,
    repaired: true,
  };
}

module.exports = {
  runAgent,
};
