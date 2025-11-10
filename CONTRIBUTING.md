# Contributing to Forky

Thank you for your interest in contributing to Forky! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- A clear and descriptive title
- Detailed description of the proposed functionality
- Explanation of why this enhancement would be useful
- Code examples or mockups (if applicable)

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes:
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

4. Commit your changes:
   ```bash
   git commit -m "feat: add amazing feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for test updates
   - `chore:` for maintenance tasks

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Setting Up Your Development Environment

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/forky.git
   cd forky
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example` if available):
   ```bash
   CLICKUP_API_KEY=your_key
   CLICKUP_BOT_USER_ID=your_id
   CLICKUP_WORKSPACE_ID=your_workspace
   GITHUB_TOKEN=your_token
   GITHUB_OWNER=your_username
   GITHUB_REPO=your_repo
   GITHUB_REPO_PATH=/path/to/repo
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

### Building

```bash
npm run build
```

Compiles TypeScript to JavaScript in the `dist/` directory.

### Running in Development Mode

```bash
npm run dev
```

Runs TypeScript directly using `ts-node`.

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Project Structure

```
├── lib/                      # TypeScript source modules
│   ├── ui.ts                 # CLI formatting utilities
│   ├── retry.ts              # Retry logic
│   ├── config.ts             # Configuration management
│   ├── clickup.ts            # ClickUp API client
│   ├── github.ts             # GitHub API operations
│   ├── storage.ts            # Cache and queue management
│   ├── process-manager.ts    # Process lifecycle
│   ├── progress-monitor.ts   # Progress tracking
│   ├── repo-manager.ts       # Repository management
│   ├── gemini.ts             # Gemini AI integration
│   ├── codex.ts              # Codex code review
│   ├── claude.ts             # Claude AI integration
│   └── orchestrator.ts       # Multi-AI orchestration
├── forky.ts                  # Main entry point
├── retry-codex-review.ts     # Utility script
├── forky.test.ts             # Jest test suite
└── dist/                     # Compiled JavaScript
```

## Testing Guidelines

- Write unit tests for new functionality
- Maintain or improve code coverage
- Test edge cases and error conditions
- Use descriptive test names
- Mock external dependencies (APIs, file system, etc.)

## Documentation

- Update the README.md if you change functionality
- Add JSDoc comments to public functions
- Update inline comments for complex logic
- Add examples for new features

## Questions?

Feel free to open an issue for:
- Questions about the codebase
- Clarification on contribution guidelines
- Discussion of potential features

## License

By contributing to Forky, you agree that your contributions will be licensed under the MIT License.
