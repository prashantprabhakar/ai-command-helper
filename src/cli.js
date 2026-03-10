#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { runPipeline } = require('./graph');
const { executeCommand } = require('./tools/executeCommand');
const { checkCommandAvailable } = require('./tools/commandChecker');
const { repairCommand } = require('./agents/repairAgent');

function usage() {
  console.log('Usage: ai-cmd [--yes] [--shell=<shell>] "<natural language instruction>"');
  console.log('Example: ai-cmd "find large files"');
  console.log('Example (auto-confirm): ai-cmd --yes "find large files"');
  console.log('Example (PowerShell): ai-cmd --shell=pwsh "find large files"');
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    // In case stdin is already ended
    if (process.stdin.readableEnded) {
      resolve(data);
    }
  });
}

async function askYesNo(question) {
  if (!process.stdin.isTTY) {
    // In non-interactive environments, try to read stdin for an answer.
    const stdin = (await readStdin()).trim().toLowerCase();
    return stdin === 'y' || stdin === 'yes';
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

function detectShell() {
  const env = process.env;

  // On Windows, prefer MSYS/MinGW when present (git bash)
  if (process.platform === 'win32') {
    // Git Bash / MSYS
    if (env.MSYSTEM) {
      return 'bash';
    }
    if (env.SHELL && env.SHELL.toLowerCase().includes('bash')) {
      return 'bash';
    }
    if (env.ComSpec && env.ComSpec.toLowerCase().includes('powershell')) {
      return 'powershell';
    }
    if (env.ComSpec && env.ComSpec.toLowerCase().includes('cmd.exe')) {
      return 'cmd';
    }
    return 'cmd';
  }

  // On POSIX, use SHELL if available.
  if (env.SHELL) {
    const lowered = env.SHELL.toLowerCase();
    if (lowered.includes('zsh')) return 'zsh';
    if (lowered.includes('bash')) return 'bash';
    if (lowered.includes('fish')) return 'fish';
    return 'sh';
  }

  return 'sh';
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = [];
  const flags = {
    yes: false,
    shell: undefined,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    if (arg === '--yes' || arg === '-y') {
      flags.yes = true;
      continue;
    }

    if (arg.startsWith('--shell=')) {
      flags.shell = arg.split('=')[1];
      continue;
    }

    if (arg === '--shell' && i + 1 < rawArgs.length) {
      flags.shell = rawArgs[i + 1];
      i += 1;
      continue;
    }

    args.push(arg);
  }

  if (args.length === 0) {
    usage();
    process.exit(1);
  }

  const rawQuery = args.join(' ').trim();

  if (!rawQuery) {
    usage();
    process.exit(1);
  }

  const detectedShell = flags.shell || detectShell();


  const result = await runPipeline({ query: rawQuery, platform: process.platform, shell: detectedShell });

  // Normalize command string (strip wrapping backticks/quotes) for display and execution.
  const cmd = (result.command || '').trim().replace(/^['"`]+|['"`]+$/g, '');

  // Pre-check whether the generated command is available in PATH.
  const availability = await checkCommandAvailable(cmd, process.platform);
  if (!availability.exists) {
    console.warn('\n⚠ Command not found:', availability.command);
    if (availability.hint?.install) {
      console.warn('  Suggestion:', availability.hint.install);
    }
    if (availability.hint?.alternatives?.length) {
      console.warn('  Alternatives:', availability.hint.alternatives.join(', '));
    }
    console.warn('  You may need to install it or run in a different shell.');
  }

  console.log('\nCommand:');
  console.log(cmd || '(no command generated)');
  console.log('\nExplanation:');
  console.log(result.explanation || '(no explanation generated)');

  if (result.risky) {
    console.log('\n⚠ Warning: This command may be unsafe.');
    if (result.reason) {
      console.log('Reason:', result.reason);
    }
  }

  const shouldRun = flags.yes || (await askYesNo('\nRun command? (y/n) '));
  if (availability.exists === false && shouldRun) {
    console.log('\nNote: the command does not appear to be installed.');
    console.log('If you still want to attempt it, the error will be shown below.');
  }
  if (!shouldRun) {
    console.log('Cancelled.');
    process.exit(0);
  }

  if (!result.command) {
    console.log('No command to execute.');
    process.exit(1);
  }

  async function runWithRepair(command) {
    const result = await executeCommand(command, { shell: detectedShell });

    if (!result.error) {
      return { success: true, command, result };
    }

    // Try to repair the command once if it fails.
    const repair = await repairCommand({
      command,
      errorMessage: result.error.message,
      stderr: result.stderr,
      stdout: result.stdout,
      platform: process.platform,
      shell: detectedShell,
      query: rawQuery,
    });

    const repairedCommand = (repair || '').trim();
    if (!repairedCommand || repairedCommand === command) {
      return { success: false, command, result };
    }

    console.log('\n[ai-cmd] Repaired command suggestion:');
    console.log(repairedCommand);

    const shouldRunRepaired = flags.yes || (await askYesNo('\nRun repaired command? (y/n) '));
    if (!shouldRunRepaired) {
      return { success: false, command, result };
    }

    const secondTry = await executeCommand(repairedCommand, { shell: detectedShell });
    return { success: !secondTry.error, command: repairedCommand, result: secondTry };
  }

  const runResult = await runWithRepair(cmd);
  if (!runResult.success) {
    console.error('Command failed:', runResult.result.error);
    if (runResult.result.stderr) {
      console.error(runResult.result.stderr);
    }
    process.exit(1);
  }

  if (runResult.result.stdout) {
    process.stdout.write(runResult.result.stdout);
  }
  if (runResult.result.stderr) {
    process.stderr.write(runResult.result.stderr);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
