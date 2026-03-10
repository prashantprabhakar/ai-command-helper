const { exec } = require('child_process');

const fallbackHints = {
  lsof: {
    install: {
      linux: 'sudo apt install lsof (or your distro package manager)',
      mac: 'brew install lsof',
      windows: 'Use WSL or install a Windows build of lsof, or use `netstat`/`Get-NetTCPConnection`.',
    },
    alternatives: ['netstat', 'ss', 'Get-NetTCPConnection'],
  },
  netstat: {
    install: {
      linux: 'sudo apt install net-tools',
      mac: 'brew install net-tools',
      windows: 'Built into Windows (no install needed)',
    },
    alternatives: ['ss', 'Get-NetTCPConnection'],
  },
  ss: {
    install: {
      linux: 'sudo apt install iproute2',
      mac: 'ss is not typically available on macOS; use netstat',
      windows: 'Use netstat or Get-NetTCPConnection',
    },
    alternatives: ['netstat'],
  },
};

function _stripWrappingChars(text) {
  if (!text || typeof text !== 'string') return text;
  return text.trim().replace(/^['"`]+|['"`]+$/g, '');
}

function _getFirstToken(command) {
  if (!command || typeof command !== 'string') return null;
  const cleaned = _stripWrappingChars(command.trim());
  const match = cleaned.match(/^[^\s"']+/);
  return match ? _stripWrappingChars(match[0]) : null;
}

function _commandLookup(command) {
  const cmd = _getFirstToken(command);
  if (!cmd) return null;
  return cmd;
}

function _buildHint(cmd, platform) {
  const normalized = cmd.toLowerCase();
  const hint = fallbackHints[normalized];
  if (!hint) return null;

  const platformKey = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux';
  const install = hint.install?.[platformKey] || Object.values(hint.install || {})[0];
  const alternatives = hint.alternatives || [];
  return { install, alternatives };
}

/**
 * Checks if the primary executable for a shell command exists in PATH.
 *
 * Returns:
 * {
 *   exists: boolean,
 *   command: string,
 *   paths: string[],
 *   hint?: { install: string, alternatives: string[] }
 * }
 */
function checkCommandAvailable(command, platform = process.platform) {
  const cmd = _commandLookup(command);
  if (!cmd) {
    return { exists: false, command, paths: [], hint: null };
  }

  const checker = platform === 'win32' ? 'where' : 'command -v';
  const full = platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;

  return new Promise((resolve) => {
    exec(full, { shell: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      const paths = stdout
        ? stdout
            .toString()
            .split(/\r?\n/)
            .filter(Boolean)
        : [];

      const exists = !err && paths.length > 0;
      const hint = !exists ? _buildHint(cmd, platform) : null;

      resolve({ exists, command: cmd, paths, hint });
    });
  });
}

module.exports = {
  checkCommandAvailable,
};
