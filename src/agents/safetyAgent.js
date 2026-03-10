/**
 * Simple heuristic-based safety validator.
 *
 * Marks commands as risky if they match known destructive patterns.
 */

const riskyPatterns = [
  { regex: /\brm\s+-rf\b/, reason: 'Recursive delete (rm -rf) detected' },
  { regex: /\brm\s+-r\b/, reason: 'Recursive remove (rm -r) detected' },
  { regex: /\bmkfs\b/, reason: 'Filesystem formatting command detected' },
  { regex: /\bdd\b.*\bif=.*\bof=/, reason: 'Low-level disk write (dd) detected' },
  { regex: /\b:\(\)\s*\{\s*\|\s*\}:\s*;/, reason: 'Fork bomb detected' },
  { regex: /\bsudo\s+rm\s+-rf\b/, reason: 'Sudo recursive delete' },
  { regex: /\bshutdown\b/, reason: 'Shutdown command detected' },
  { regex: /\breboot\b/, reason: 'Reboot command detected' },
  { regex: /\bmkfs\.\b/, reason: 'Filesystem formatting command detected' },
  { regex: /\b:>\b/, reason: 'Potential destructive redirection detected' },
];

function validateSafety({ command }) {
  if (!command || typeof command !== 'string') {
    return { risky: false };
  }

  const normalized = command.trim();

  for (const pattern of riskyPatterns) {
    if (pattern.regex.test(normalized)) {
      return { risky: true, reason: pattern.reason };
    }
  }

  // Some basic heuristics for empty or nonsensical commands
  if (normalized.length === 0) {
    return { risky: false };
  }

  return { risky: false };
}

module.exports = {
  validateSafety,
};
