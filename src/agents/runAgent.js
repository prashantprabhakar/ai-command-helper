// runAgent.js
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

function _normalizeCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return '';
  return cmd.trim().replace(/^['"`]+|['"`]+$/g, '');
}

function _balanceQuotes(cmd) {
  if (!cmd || typeof cmd !== 'string') return cmd;

  const quoteChars = ['"', "'", '`'];
  let balanced = cmd;

  for (const q of quoteChars) {
    const count = (balanced.match(new RegExp(`\\${q}`, 'g')) || []).length;
    if (count % 2 !== 0) {
      balanced = `${balanced}${q}`;
    }
  }

  return balanced;
}

async function runAgent(state) {
  const { command, shell, runCommand, platform, query, verbose } = state;

  if (!runCommand) {
    return {
      ...state,
      executedSuccessfully: false,
      executedCommand: null,
      stdout: '',
      stderr: '',
    };
  }

  const maxAttempts = 3;
  let attempts = 0;
  let currentCommand = _normalizeCommand(command);
  let lastExec = { error: new Error('No command generated'), stdout: '', stderr: '' };

  const attemptHistory = [];

  while (attempts < maxAttempts) {
    attempts += 1;

    const attemptRecord = {
      attempt: attempts,
      command: currentCommand || '<none>',
      success: false,
      errorMessage: null,
      exitCode: null,
      stdout: '',
      stderr: '',
    };

    if (attempts === 1) {
      process.stdout.write(`\nRunning command: ${attemptRecord.command}`);
    } else {
      process.stdout.write(`\nAttempt #${attempts} -> running command: ${attemptRecord.command}`);
    }

    if (currentCommand) {
      currentCommand = _balanceQuotes(currentCommand);

      lastExec = await executeCommand(currentCommand, { shell });

      attemptRecord.stdout = lastExec.stdout;
      attemptRecord.stderr = lastExec.stderr;
      attemptRecord.exitCode = lastExec.error?.code;

      if (!lastExec.error) {
        attemptRecord.success = true;
        attemptHistory.push(attemptRecord);

        process.stdout.write(' ✅\n');

        return {
          ...state,
          executedSuccessfully: true,
          executedCommand: currentCommand,
          stdout: lastExec.stdout,
          stderr: lastExec.stderr,
          attempts,
          attemptHistory,
        };
      }

      attemptRecord.errorMessage = (lastExec.error.message || '').split(/\r?\n/)[0];
      process.stdout.write(' ❌\n');

      if (verbose) {
        console.error(`    Error: ${attemptRecord.errorMessage}`);
      }
    } else {
      attemptRecord.errorMessage = 'No command was generated to execute.';
      process.stdout.write(' ❌\n');

      if (verbose) {
        console.error('    Error: No command generated.');
      }
    }

    attemptHistory.push(attemptRecord);

    const repaired = await repairCommand({
      command: currentCommand,
      errorMessage: attemptRecord.errorMessage || 'Failed to generate or execute command',
      stderr: attemptRecord.stderr,
      stdout: attemptRecord.stdout,
      platform,
      shell,
      query,
    });

    const repairedCommand = _normalizeCommand(repaired);

    if (!repairedCommand || repairedCommand === currentCommand.trim()) {
      break;
    }

    if (verbose) {
      console.log(`  🔧 Repair suggested: ${repairedCommand}`);
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
    attemptHistory,
  };
}

module.exports = {
  runAgent,
};