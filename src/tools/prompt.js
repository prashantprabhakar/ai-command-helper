const readline = require('readline');

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

    if (process.stdin.readableEnded) {
      resolve(data);
    }
  });
}

async function askYesNo(question) {
  if (!process.stdin.isTTY) {
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

module.exports = {
  askYesNo,
};
