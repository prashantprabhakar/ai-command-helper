# AI Terminal Command Helper

A lightweight CLI that converts **natural language instructions into safe shell commands** using a local LLM (via Ollama).

## Features

- Translate plain English into shell commands
- Provide a short explanation of what the command does
- Validate commands for safety (warns about destructive patterns)
- Ask for user confirmation before running
- Runs fully locally (requires Ollama)

## Installation

1. Install [Ollama](https://ollama.com/) and ensure `ollama` is on your PATH.
2. Clone this repo and install dependencies:

```bash
npm install
```

## Usage

```bash
npx ai-cmd "find large files in this folder"
```

Example output:

```
Command:
find . -type f -size +100M

Explanation:
Searches the current directory recursively for files larger than 100MB.

Run command? (y/n)
```

## Notes

- The tool uses a small prompt-based LLM workflow to generate commands. You can adjust prompts in `src/agents/*Agent.js`.
- It is intentionally cautious and requires manual confirmation before executing.
