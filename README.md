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
git clone https://github.com/<your-org>/ai-cli-helper.git
cd ai-cli-helper
npm install
```

3. Install the CLI globally so you can run it from anywhere:

```bash
npm install -g .
```

## Usage

Once installed globally, you can run the tool as `ai-cmd`.

### Basic

```bash
ai-cmd "find large files in this folder"
```

### Auto-confirm (skip prompt)

```bash
ai-cmd --yes "find large files in this folder"
```

### Show explanation

```bash
ai-cmd --explain "find large files in this folder"
```

### Force a specific shell

```bash
ai-cmd --shell=pwsh "list files"
```

### Example output

```
Command:
find . -type f -size +100M

Explanation:
Searches the current directory recursively for files larger than 100MB.
```

## Notes

- The tool uses a prompt-based LLM workflow to generate commands. You can adjust prompts in `src/agents/*Agent.js`.
- It is intentionally cautious and requires manual confirmation before executing.

## Configuring the LLM Provider

By default, the tool uses **Ollama** (if installed) via the `ollama` CLI.

You can configure a different provider using environment variables:

- `AI_CLI_PROVIDER` — `ollama` (default), `openai`, `anthropic`, `claude`
- `AI_CLI_MODEL` — model name to use (e.g. `mistral:latest`, `gpt-4o`, `claude-3.1`)

### Example (OpenAI)

```bash
export OPENAI_API_KEY="<your key>"
export AI_CLI_PROVIDER=openai
export AI_CLI_MODEL=gpt-4o
node ./src/cli.js "find large files"
```

### Example (Anthropic / Claude)

```bash
export ANTHROPIC_API_KEY="<your key>"
export AI_CLI_PROVIDER=anthropic
export AI_CLI_MODEL=claude-3.1
node ./src/cli.js "find large files"
```
