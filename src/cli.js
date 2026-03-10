#!/usr/bin/env node

const { runPipeline } = require('./graph');
const { checkCommandAvailable } = require('./tools/commandChecker');
const { askYesNo } = require('./tools/prompt');

function usage() {
  console.log('Usage: ai-cmd [--yes] [--shell=<shell>] "<natural language instruction>"');
  console.log('Example: ai-cmd "find large files"');
  console.log('Example (auto-confirm): ai-cmd --yes "find large files"');
  console.log('Example (PowerShell): ai-cmd --shell=pwsh "find large files"');
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

  // Generate the command (without executing it).
  const generationResult = await runPipeline({
    query: rawQuery,
    platform: process.platform,
    shell: detectedShell,
    runCommand: false,
  });

  // Normalize command string (strip wrapping backticks/quotes) for display and execution.
  const cmd = (generationResult.command || '').trim().replace(/^['"`]+|['"`]+$/g, '');

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
  console.log(generationResult.explanation || '(no explanation generated)');

  if (generationResult.risky) {
    console.log('\n⚠ Warning: This command may be unsafe.');
    if (generationResult.reason) {
      console.log('Reason:', generationResult.reason);
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

  if (!generationResult.command) {
    console.log('No command to execute.');
    process.exit(1);
  }

  // Execute (and repair if needed) via the pipeline.
  const execResult = await runPipeline({
    query: rawQuery,
    platform: process.platform,
    shell: detectedShell,
    runCommand: true,
    command: cmd,
  });

  if (!execResult.executedSuccessfully) {
    console.error('Command failed:', execResult.errorMessage || 'unknown error');
    if (execResult.stderr) {
      console.error(execResult.stderr);
    }
    process.exit(1);
  }

  if (execResult.stdout) {
    process.stdout.write(execResult.stdout);
  }
  if (execResult.stderr) {
    process.stderr.write(execResult.stderr);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
