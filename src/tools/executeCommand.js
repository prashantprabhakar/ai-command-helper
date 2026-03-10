const { exec } = require('child_process');

/**
 * Executes a shell command and returns the stdout/stderr.
 */
function executeCommand(command, options = {}) {
  const { shell } = options;
  const execOptions = {
    maxBuffer: 10 * 1024 * 1024,
    ...(shell ? { shell } : {}),
  };

  return new Promise((resolve) => {
    exec(command, execOptions, (error, stdout, stderr) => {
      resolve({
        error,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
      });
    });
  });
}

module.exports = {
  executeCommand,
};
