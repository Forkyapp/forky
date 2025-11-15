# Quick Start Guide

Get Timmy running in under 5 minutes!

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [GitHub CLI](https://cli.github.com/) (for automatic authentication)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- ClickUp account
- GitHub account

## Step-by-Step Setup

### 1. Clone & Install

```bash
git clone https://github.com/Timmyapp/clickup-claude-github.git timmy
cd timmy
npm install
```

### 2. Run Interactive Setup

```bash
npm run init
```

Follow the prompts to configure:
- GitHub authentication (automatic via browser)
- ClickUp API credentials
- Your first project
- System settings

### 3. Start Timmy

```bash
npm start
```

That's it! Timmy is now monitoring your ClickUp workspace.

## What Happens Next?

1. **Assign a task in ClickUp** to your bot user
2. **Timmy detects it** (polls every 15 seconds)
3. **Claude Code launches** automatically
4. **Feature is implemented** by Claude
5. **PR is created** on GitHub

## Quick Commands

```bash
# Setup
npm run init       # Interactive first-time setup
npm run settings   # Modify configuration later

# Project management
npm run projects   # List all projects
npm run switch     # Switch active project
npm run current    # Show current project

# Running
npm start          # Start Timmy
npm run dev        # Development mode
npm run build      # Build TypeScript

# Testing
npm test           # Run tests
npm run lint       # Check code style
```

## Configuration Files

After setup, you'll have:

```
timmy/
├── .env                  # Global credentials (API keys)
├── workspace.json        # Active project pointer
├── projects.json         # All your projects
└── .context/            # AI coding guidelines
    └── models/
        ├── claude.md     # Claude patterns (fill this!)
        ├── gemini.md     # Gemini doc style
        └── codex.md      # Codex review checklist
```

## Fill Your Context Files

To get the best results, fill `.context/models/*.md` with your coding patterns:

```bash
# Edit Claude's coding guidelines
vim .context/models/claude.md
```

Example content:
```markdown
# Error Handling

Always use try-catch blocks with custom errors:
```typescript
try {
  await operation();
} catch (error) {
  throw new CustomError('Operation failed', error);
}
```

# API Patterns

Use async/await, not callbacks...
```

See [Context System Guide](docs/CONTEXT_SYSTEM.md) for details.

## Troubleshooting

### GitHub CLI not found

```bash
# macOS
brew install gh

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
```

### Claude Code CLI not found

```bash
# Install Claude Code
curl -fsSL https://cli.anthropic.com/install.sh | sh
```

### Already have configuration files?

```bash
# Modify existing settings
npm run settings
```

## Next Steps

1. **Fill context files** with your coding patterns
2. **Assign a test task** in ClickUp
3. **Watch Timmy work** its magic
4. **Review the PR** Claude creates
5. **Refine your context** based on results

## Need Help?

- [Full Documentation](README.md)
- [Interactive Setup Guide](docs/INTERACTIVE_SETUP.md)
- [Project Management](docs/PROJECT_MANAGEMENT.md)
- [Context System](docs/CONTEXT_SYSTEM.md)
- [GitHub Issues](https://github.com/Timmyapp/clickup-claude-github/issues)

## Example Session

```bash
$ npm run init

╔═══════════════════════════════════════════════════════════╗
║                  🤖 Welcome to Timmy!                    ║
╚═══════════════════════════════════════════════════════════╝

Step 1/4: GitHub Configuration
✅ Already authenticated as kuxala
Use this GitHub account? (Y/n): y

Step 2/4: ClickUp Configuration
ClickUp API Key: pk_...
ClickUp Bot User ID: 12345
ClickUp Workspace ID: 67890

Step 3/4: Project Configuration
Project name: my-app
Repository name: my-app
Repository path: /Users/me/projects/my-app

Step 4/4: System Settings
Polling interval (15): 15
Disable comments? (N): n

✅ Setup Complete!

$ npm start
🤖 Timmy starting...
✅ Connected to ClickUp workspace: my-app
✅ GitHub authenticated as: kuxala
🔄 Polling for new tasks...

[30 seconds later]
📋 New task detected: "Add user authentication"
🚀 Launching Claude Code...
```

Happy automating! 🚀
