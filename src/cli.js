#!/usr/bin/env node

const { runPipeline } = require('./graph');
const { checkCommandAvailable } = require('./tools/commandChecker');
const { askYesNo } = require('./tools/prompt');
const { runAgent } = require('./agents/runAgent')

function usage() {
    console.log('Usage: ai-cmd [--yes] [--explain] [--shell=<shell>] "<natural language instruction>"');
    console.log('Example: ai-cmd "find large files"');
    console.log('Example (show explanation): ai-cmd --explain "find large files"');
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
    explain: false,
    verbose: false,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    if (arg === '--yes' || arg === '-y') {
      flags.yes = true;
      continue;
    }

    if (arg === '--explain') {
      flags.explain = true;
      continue;
    }

    if (arg === '--no-explain') {
      flags.explain = false;
      continue;
    }

    if (arg === '--verbose') {
      flags.verbose = true;
      continue;
    }

    if (arg === '--quiet') {
      flags.verbose = false;
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
  });

  // Normalize command string (strip wrapping backticks/quotes) for display and execution.
  const cmd = (generationResult.command || '').trim().replace(/^['"`]+|['"`]+$/g, '');

  // Only check availability if we have a command to validate.
  let availability;
  if (cmd) {
    availability = await checkCommandAvailable(cmd, process.platform);
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
  }

  // console.log('\nCommand:');
  // console.log(cmd || '(no command generated)');
  if (flags.explain) {
    console.log('\nExplanation:');
    console.log(generationResult.explanation || '(no explanation generated)');
  }

  if (generationResult.risky) {
    console.log('\n⚠ Warning: This command may be unsafe.');
    if (generationResult.reason) {
      console.log('Reason:', generationResult.reason);
    }
  }

  const shouldRun = flags.yes || (await askYesNo('\nRun command? (y/n) '));
  if (availability?.exists === false && shouldRun) {
    console.log('\nNote: the command does not appear to be installed.');
    console.log('If you still want to attempt it, the error will be shown below.');
  }
  if (!shouldRun) {
    console.log('Cancelled.');
    process.exit(0);
  }

  // Execute (and repair if needed) via the runAgent directly.
  const execResult = await runAgent({
    command: cmd,
    shell: detectedShell,
    platform: process.platform,
    query: rawQuery,
    runCommand: true,
    verbose: flags.verbose,
  });

  if (!execResult.executedSuccessfully) {
    if (flags.verbose) {
      console.error('\n❌ Unable to execute command after retrying.');
      if (execResult.attempts && execResult.attempts > 1) {
        console.error(`   (Attempted ${execResult.attempts} time${execResult.attempts > 1 ? 's' : ''})`);
      }

      if (Array.isArray(execResult.attemptHistory) && execResult.attemptHistory.length) {
        console.error('\nAttempt history:');
        execResult.attemptHistory.forEach((attempt) => {
          const status = attempt.success ? '✅' : '❌';
          const msg = attempt.errorMessage ? ` - ${attempt.errorMessage}` : '';
          console.error(`  ${attempt.attempt}) ${attempt.command} ${status}${msg}`);
        });
      }

      if (execResult.errorMessage) {
        console.error(`\nFinal error: ${execResult.errorMessage}`);
      }
      if (execResult.stderr) {
        console.error(execResult.stderr);
      }
    } else {
      if (execResult.errorMessage) {
        console.error(`\nError: ${execResult.errorMessage}`);
      }
    }
    process.exit(1);
  }

  if (execResult.stdout) {
    // Separate the explanation from the command output when printing.
    // Some commands (like dir/ls) can appear immediately after the explanation
    // output if there isn't a blank line.
    process.stdout.write('\n');
    process.stdout.write(execResult.stdout);
  }
  if (execResult.stderr) {
    // Stderr often follows stdout directly; add a newline to keep output clean.
    process.stderr.write('\n');
    process.stderr.write(execResult.stderr);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
