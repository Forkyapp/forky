# Forky - Autonomous Local Integration

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/kuxala/clickup-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/kuxala/clickup-bot/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

Fully automated ClickUp task detection that launches Claude Code in separate Terminal windows.

> **Open Source Project**: Forky is an open-source automation tool that bridges ClickUp task management with Claude Code's AI-powered development capabilities. Contributions welcome!

## How It Works

```
┌──────────────────────────────────────────┐
│ 1. YOU: Assign ClickUp Task             │
│    - Set status: "bot in progress"      │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│ 2. FORKY: Polls ClickUp (every 60s)     │
│    - Detects new "bot in progress" task │
│    - Automatically launches Claude Code  │
│    - Opens in NEW Terminal window        │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│ 3. CLAUDE CODE: Auto-started            │
│    - Receives full task context         │
│    - Works in interactive Terminal       │
│    - Implements feature autonomously     │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│ 4. RESULT: PR Created                   │
│    - Branch pushed to GitHub            │
│    - Pull Request opened automatically  │
│    - Ready for your review              │
└──────────────────────────────────────────┘
```

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Security](#security)

## Features

- Fully automated task detection from ClickUp
- Automatic Claude Code session launching
- Interactive AI-powered development
- Seamless GitHub integration
- TypeScript codebase with full type safety
- Comprehensive test coverage
- Process management with PM2 support

## Prerequisites

Before you begin, ensure you have:

- Node.js 18 or higher
- npm or yarn
- Git
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- ClickUp account with API access
- GitHub account with personal access token
- macOS (for automatic Terminal window launching)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kuxala/clickup-bot.git
   cd clickup-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Setup

### 1. Configure Environment

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Required - already configured
CLICKUP_API_KEY=your_key
CLICKUP_BOT_USER_ID=your_id
CLICKUP_WORKSPACE_ID=your_workspace
GITHUB_TOKEN=your_token
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo
GITHUB_REPO_PATH=/full/path/to/your/repo

# Optional - auto-detected if not set
CLAUDE_CLI_PATH=/Users/user/.local/bin/claude
POLL_INTERVAL_MS=60000
```

### 2. Verify Claude Code CLI

```bash
which claude
# Should output: /Users/user/.local/bin/claude

claude --version
# Should output: 2.0.5 (Claude Code)
```

### 3. Test Repository Access

```bash
cd $GITHUB_REPO_PATH
git status
# Should work without errors
```

## Usage

### Start Forky

```bash
cd /Users/user/Documents/Personal\ Projects/clickup-claude-github/local
node forky.js
```

You should see:

```
======================================================================
🤖 FORKY - ClickUp Task Queue Manager
======================================================================

📍 Workspace: 90181842045
👤 Bot User ID: 87761917
📁 GitHub Repo: /path/to/your/repo
⏱️  Poll Interval: 60s
💾 Already Detected: 0 tasks
📊 Current Queue: 0 pending, 0 completed

✅ Configuration validated
🚀 Starting polling...
💡 New tasks will automatically launch Claude Code in a new Terminal
```

### Create a Task

1. Go to ClickUp
2. Create a new task with:
   - **Title:** Clear feature name (e.g., "Add user login validation")
   - **Description:** Detailed implementation requirements
   - **Assignee:** Yourself
   - **Status:** "bot in progress"

3. Within 60 seconds, Forky will:
   - Detect the task
   - **Automatically open a NEW Terminal window**
   - Launch Claude Code with full task context
   - Display progress in Forky terminal

4. Watch the new Terminal window:
   - Claude Code will receive the task details
   - Implement the feature interactively
   - You can see progress and respond if needed
   - PR will be created automatically when done

## How Tasks are Processed

### Task Detection (Fully Automatic)

Forky continuously:
- Polls ClickUp API every 60 seconds
- Filters for tasks with status "bot in progress"
- Skips already-detected tasks (cached in `processed-tasks.json`)
- **Automatically launches Claude Code** when new task found

### Claude Code Launch (via osascript)

When a new task is detected:

1. **Forky creates comprehensive prompt** with:
   - Full task context (title, description, URL)
   - Repository path and branch name
   - All Git workflow steps
   - Commit message and PR title pre-formatted

2. **Opens NEW Terminal window** using macOS `osascript`:
   - Changes to repository directory
   - Launches Claude Code CLI
   - Pipes full prompt to Claude Code
   - Window stays visible for interaction

3. **Claude Code works autonomously**:
   - Receives all task details upfront
   - Creates branch: `task-{taskId}`
   - Implements the feature
   - Commits: `feat: {title} (#{taskId})`
   - Pushes to GitHub
   - Creates PR: `[ClickUp #{taskId}] {title}`
   - Can ask clarifying questions if needed

4. **Fallback to queue** if launch fails:
   - Task added to `task-queue.json`
   - You can process it manually later

## TypeScript Migration

This codebase has been fully migrated to TypeScript! 🎉

### What Changed

- ✅ All `.js` files converted to `.ts` with full type annotations
- ✅ Comprehensive interfaces for all data structures
- ✅ ES6 module imports/exports (replacing CommonJS)
- ✅ Type-safe error handling
- ✅ Full IDE autocomplete and type checking support

### Building and Running

**Build TypeScript to JavaScript:**
```bash
npm run build
```

**Run the compiled code:**
```bash
npm start
```

**Run TypeScript directly (development):**
```bash
npm run dev
```

**Run tests:**
```bash
npm test
```

**Clean build artifacts:**
```bash
npm run clean
```

### File Structure

```
├── lib/                      # TypeScript source modules
│   ├── ui.ts                 # CLI formatting utilities
│   ├── retry.ts              # Retry logic with exponential backoff
│   ├── config.ts             # Configuration management
│   ├── clickup.ts            # ClickUp API client
│   ├── github.ts             # GitHub API operations
│   ├── storage.ts            # Cache, queue, and tracking
│   ├── process-manager.ts    # Process lifecycle management
│   ├── progress-monitor.ts   # Progress tracking
│   ├── repo-manager.ts       # Repository management
│   ├── gemini.ts             # Gemini AI integration
│   ├── codex.ts              # Codex code review
│   ├── claude.ts             # Claude AI integration
│   └── orchestrator.ts       # Multi-AI workflow orchestration
├── forky.ts                  # Main entry point
├── retry-codex-review.ts     # Utility script
├── forky.test.ts             # Jest test suite
├── dist/                     # Compiled JavaScript (git-ignored)
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

### TypeScript Benefits

1. **Type Safety** - Catch bugs at compile-time instead of runtime
2. **Better IDE Support** - Full autocomplete, inline docs, and refactoring
3. **Self-Documenting** - Types serve as inline documentation
4. **Easier Maintenance** - Clear contracts between functions
5. **Refactoring Confidence** - Type system ensures correctness

## Troubleshooting

### Forky doesn't detect tasks

1. Check ClickUp credentials:
   ```bash
   node -e "require('dotenv').config({path: '../.env'}); console.log(process.env.CLICKUP_API_KEY)"
   ```

2. Verify task status is exactly "bot in progress" (lowercase)

3. Check task is assigned to correct user ID

### Tasks queued but not processed

1. Check `task-queue.json` - tasks should appear in `pending` array

2. Tell Claude Code to process queue:
   ```
   You: "process the queue"
   ```

3. If you're not in Claude Code session, open one:
   ```bash
   cd /path/to/your/repo
   claude
   ```

### Queue file is empty

1. Verify tasks have "bot in progress" status (exact match, lowercase)

2. Check Forky is running and polling:
   ```bash
   # Should show polling logs
   ```

### Duplicate PRs created

- Processed tasks are cached in `processed-tasks.json`
- Delete this file to reset cache
- Forky won't reprocess tasks unless cache is cleared

## Stopping Forky

Press `Ctrl+C` to gracefully stop Forky.

The processed tasks cache is saved automatically on exit.

## Running in Background

### Using nohup

```bash
nohup node forky.js > forky.log 2>&1 &

# View logs
tail -f forky.log

# Stop
pkill -f "node forky.js"
```

### Using pm2

```bash
npm install -g pm2

pm2 start forky.js --name forky
pm2 logs forky
pm2 stop forky
pm2 restart forky
```

## Important Notes

### Limitations

- **macOS only** - Uses `osascript` to launch Terminal windows (macOS specific)
- **Computer must stay running** - Forky is a local process (polls ClickUp)
- **Multiple Terminal windows** - Each task opens a new window (can get cluttered)
- **Interactive when needed** - Claude Code may ask questions for complex tasks
- **Sequential processing** - Tasks processed one at a time (60s poll interval)

### Best Practices

1. **Write clear task descriptions** - More detail = better autonomous implementation
2. **Watch Terminal windows** - Claude Code will open in new windows, keep an eye on them
3. **Respond to questions** - If Claude asks for clarification, respond in the new Terminal
4. **Review PRs before merging** - Always verify the implementation before merging
5. **Keep Forky running** - Use `pm2` or `nohup` for background execution
6. **Manage Terminal clutter** - Close completed Terminal windows to stay organized

### Status Workflow

- `"to do"` → Your backlog (ignored)
- `"in progress"` → Your manual work (ignored)
- `"bot in progress"` → Forky processes (automated)
- `"can be checked"` → Ready for review (set by Forky)

## Comparison with Other Modes

| Feature | Forky (local) | local-poll.js | Vercel Server |
|---------|--------------|---------------|---------------|
| Runs where | Your computer | Your computer | Cloud (Vercel) |
| AI implementation | Claude Code | Claude Code | No AI (mock) |
| Task detection | Automatic | Automatic | Manual API call |
| Claude Code launch | Automatic (osascript) | Manual (copy prompt) | N/A |
| Task implementation | Autonomous (visible) | Semi-automatic | Automatic (mock) |
| Requires computer on | Yes | Yes | No |
| Terminal windows | New window per task | You manage | N/A |
| Manual trigger needed | No (fully automatic) | Yes (copy prompt) | No |
| macOS required | Yes | No | No |

**Use Forky when:** You want fully automated task detection + Claude Code implementation on macOS.

**Advantages:**
- ✅ Fully automated - no manual triggers
- ✅ Interactive - Claude Code can ask questions
- ✅ Visible progress - see what's happening in real-time
- ✅ Proper environment - Claude Code runs in full Terminal context

**Disadvantages:**
- ❌ macOS only (uses osascript)
- ❌ Multiple Terminal windows (can get cluttered)
- ❌ Computer must stay running

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of Conduct
- Development setup
- How to submit pull requests
- Coding standards
- Testing guidelines

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

For security concerns, please review our [Security Policy](SECURITY.md).

## Support

- **Documentation**: Check the [docs](docs/) folder for detailed guides
- **Issues**: Report bugs via [GitHub Issues](https://github.com/kuxala/clickup-bot/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/kuxala/clickup-bot/discussions)

## Acknowledgments

- Built with [Claude Code](https://www.anthropic.com/claude)
- Integrates with [ClickUp API](https://clickup.com/api)
- Powered by [TypeScript](https://www.typescriptlang.org/)

---

Made with ❤️ by the Forky community
