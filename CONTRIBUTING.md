# Contributing to local-component-mcp

First off, thank you for considering contributing to `local-component-mcp`! It's people like you who make this tool better for everyone.

Below is a set of guidelines and instructions to help you get started with contributing.

---

## 🐛 Reporting Bugs

If you find a bug (such as parsing errors on certain component syntaxes, alias resolution failures, or server crashes):

1. **Check Existing Issues**: Search the GitHub Issue tracker to see if the bug has already been reported.
2. **Submit a New Issue**: If it hasn't, open a new issue.
3. **Include Details**:
   - The framework and version (e.g. Vue 3.4 setup script, React 18 TSX).
   - A minimal code snippet of the component or store that causes the failure.
   - The error traceback or terminal logs.
   - Your AI client (e.g. Cursor, Claude Desktop, Claude Code).

---

## 💡 Requesting Features

We welcome ideas for new tools, support for other frameworks, or additional store parsers!

1. Open an issue on GitHub.
2. Clearly describe the feature and its value (e.g., "Add support for Svelte components").
3. Provide examples of the expected AST structure or output JSON format if possible.

---

## 🛠️ Local Development Setup

To modify the codebase locally and test it in your editor:

### 1. Prerequisites
- **Node.js**: Version 18 or above.
- **pnpm**: Version 10 or above (recommended).

### 2. Setup Codebase
Clone the repository and install dependencies:
```bash
git clone https://github.com/wllcyg/local-component-mcp.git
cd local-component-mcp
pnpm install
```

### 3. Build & Watch
Compile TypeScript files:
```bash
pnpm build
```

### 4. Running Tests
Run the unit test suite to verify everything works:
```bash
pnpm test:run
```

### 5. Local Debugging in Cursor / Claude
You can configure your local built server in your AI client to test changes immediately.

**Cursor configuration**:
* Name: `local-component-mcp-debug`
* Type: `command`
* Command: `node /path/to/local-component-mcp/build/index.js` (Use the absolute path to your cloned repository build directory)

---

## 🚀 Pull Request Guidelines

1. **Create a Branch**: Create a feature or bugfix branch off `main` (e.g. `feat/svelte-support` or `fix/vue-slots`).
2. **Write Unit Tests**: If you are adding a parser or a tool, add a corresponding test file under `tests/`.
3. **Verify Build & Tests**: Ensure `pnpm build` and `pnpm test:run` both pass successfully.
4. **Submit PR**: Open a Pull Request targeting the `main` branch. Provide a description of the changes and link any related issues.
