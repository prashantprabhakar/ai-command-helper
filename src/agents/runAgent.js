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
    return { ...state, executedSuccessfully: false, executedCommand: null, stdout: '', stderr: '' };
  }

  const maxAttempts = 3;
  let attempts = 0;
  let currentCommand = command ? command.trim() : '';
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

    // Print each attempt so users see progress.
    if (attempts === 1) {
      // First run is the primary command.
      // eslint-disable-next-line no-console
      process.stdout.write(`\nRunning command: ${attemptRecord.command}`);
    } else {
      // Subsequent retries should be clearly labeled as such.
      // eslint-disable-next-line no-console
      process.stdout.write(`\nAttempt #${attempts} -> running command: ${attemptRecord.command}`);
    }

    if (currentCommand) {
      // Apply simple heuristics to fix common issues (like missing closing quotes)
      currentCommand = _balanceQuotes(currentCommand);

      lastExec = await executeCommand(currentCommand, { shell });
      attemptRecord.stdout = lastExec.stdout;
      attemptRecord.stderr = lastExec.stderr;
      attemptRecord.exitCode = lastExec.error?.code;

      if (!lastExec.error) {
        attemptRecord.success = true;
        attemptHistory.push(attemptRecord);

        // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      process.stdout.write(' ❌\n');

      if (verbose) {
        // Print a short error line below to keep the command line clean.
        // eslint-disable-next-line no-console
        console.error(`    Error: ${attemptRecord.errorMessage}`);
      }
    } else {
      // No command to execute; this is treated as a failure and triggers repair.
      attemptRecord.errorMessage = 'No command was generated to execute.';
      // eslint-disable-next-line no-console
      process.stdout.write(' ❌\n');

      if (verbose) {
        // eslint-disable-next-line no-console
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

    const repairedCommand = (repaired || '').trim();
    if (!repairedCommand || repairedCommand === currentCommand) {
      break;
    }

    if (verbose) {
      // eslint-disable-next-line no-console
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
