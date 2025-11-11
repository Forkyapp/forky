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

### 1. Configure Global Credentials

Create a `.env` file with your API credentials (copy from `.env.example`):

```bash
# Global credentials (used for all projects)
CLICKUP_API_KEY=your_key
CLICKUP_BOT_USER_ID=your_id
GITHUB_TOKEN=your_token

# Optional system settings
CLAUDE_CLI_PATH=/Users/user/.local/bin/claude
POLL_INTERVAL_MS=15000
```

### 2. Configure Your Projects

Create `projects.json` with your project configurations:

```bash
cp projects.json.example projects.json
# Edit with your projects
```

Example:

```json
{
  "projects": {
    "my-project": {
      "name": "My Project",
      "description": "Main production project",
      "clickup": {
        "workspaceId": "your_workspace_id"
      },
      "github": {
        "owner": "your_username",
        "repo": "your_repo",
        "path": "/full/path/to/your/repo",
        "baseBranch": "main"
      }
    }
  }
}
```

### 3. Set Active Project

```bash
npm run switch my-project
```

This creates `workspace.json` which tracks your currently active project.

**That's it!** No more editing `.env` to switch projects. Just use `npm run switch <project-name>`.

## Project Management

Switch between projects instantly without editing configuration files:

```bash
# List all projects
npm run projects

# Switch to a project
npm run switch my-project

# Show current active project
npm run current
```

See the [Project Management Guide](docs/PROJECT_MANAGEMENT.md) for detailed information.

## Verify Claude Code CLI

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

## Local Storage & Data Management

Forky uses JSON files as a lightweight local database to persist state across runs. All runtime data is organized in the `data/` directory with a clear structure.

### Directory Structure

```
data/
├── cache/              # Deduplication and processed item caches
│   ├── processed-tasks.json
│   └── processed-comments.json
│
├── state/              # Application state and queues
│   ├── task-queue.json
│   └── pipeline-state.json
│
└── tracking/           # Progress and status tracking
    ├── pr-tracking.json
    └── review-tracking.json
```

### Storage Files Overview

All files in `data/` are automatically excluded from version control:

| File | Purpose | Structure |
|------|---------|-----------|
| **cache/processed-tasks.json** | Cache of detected tasks to prevent duplicates | Array of task objects |
| **cache/processed-comments.json** | Deduplication cache for PR comments | Array of comment IDs |
| **state/task-queue.json** | Queue of pending and completed tasks | Object with `pending` and `completed` arrays |
| **state/pipeline-state.json** | Pipeline execution state and stage tracking | Object mapping task IDs to pipeline data |
| **tracking/pr-tracking.json** | Tracks PR creation status for tasks | Array of tracking entries |
| **tracking/review-tracking.json** | Manages PR review cycles and iterations | Array of review entries |

### Configuration Files

Kept in project root:

| File | Purpose | Version Control |
|------|---------|-----------------|
| **repos.json** | Repository configurations (paths, owners, branches) | Ignored (contains sensitive paths) |
| **repos.json.example** | Template for repos.json | Tracked |

### Runtime Directories

Also excluded from version control:

- **progress/** - Real-time progress tracking for AI agent execution
- **logs/** - Application logs and debug information
- **docs/** - Auto-generated feature documentation

### First-Time Setup

1. **Initialize data files** (copy from .example templates):
   ```bash
   # From project root
   cp data/cache/processed-tasks.json.example data/cache/processed-tasks.json
   cp data/cache/processed-comments.json.example data/cache/processed-comments.json
   cp data/state/task-queue.json.example data/state/task-queue.json
   cp data/state/pipeline-state.json.example data/state/pipeline-state.json
   cp data/tracking/pr-tracking.json.example data/tracking/pr-tracking.json
   cp data/tracking/review-tracking.json.example data/tracking/review-tracking.json
   ```

2. **Configure repositories** (required):
   ```bash
   cp repos.json.example repos.json
   # Edit repos.json with your repository details
   ```

Alternatively, use this one-liner:
```bash
for f in data/cache/*.example data/state/*.example data/tracking/*.example; do cp "$f" "${f%.example}"; done
```

### Storage Architecture

**Repository Pattern:**
- **Location:** `src/core/repositories/` and `lib/storage/`
- **Pattern:** Load → Modify → Save (atomic file replacement)
- **I/O:** Synchronous file operations for simplicity
- **Format:** Pretty-printed JSON (2-space indentation)
- **Error Handling:** Custom error classes with context
- **Type Safety:** Full TypeScript types in `lib/types/storage.types.ts`

### Backup & Restore

**Backup all state:**
```bash
tar -czf forky-backup-$(date +%Y%m%d).tar.gz data/
```

**Restore from backup:**
```bash
tar -xzf forky-backup-YYYYMMDD.tar.gz
```

**Reset to clean state:**
```bash
# Remove all data files
rm -f data/cache/*.json data/state/*.json data/tracking/*.json

# Reinitialize from templates
for f in data/cache/*.example data/state/*.example data/tracking/*.example; do
  cp "$f" "${f%.example}"
done
```

### Important Notes

- **Organized structure** - Clear separation: cache, state, and tracking
- **Not committed** - All `data/` contents ignored, only `.gitkeep` and `.example` files tracked
- **Auto-initialization** - Missing files are created automatically on first run
- **Configuration separate** - `repos.json` stays in root as it's config, not runtime state
- **Safe to delete** - You can always restore from `.example` templates

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

## Architecture & Codebase

This codebase has been fully migrated to TypeScript with a modern, scalable architecture! 🎉

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

### Project Structure

```
clickup-bot/
├── src/                          # New architecture (Phase 1)
│   ├── types/                    # Centralized type definitions
│   │   ├── clickup.ts            # ClickUp domain types
│   │   ├── github.ts             # GitHub domain types
│   │   ├── config.ts             # Configuration types
│   │   ├── ai.ts                 # AI service types
│   │   ├── storage.ts            # Storage/state management
│   │   ├── orchestrator.ts       # Workflow orchestration
│   │   ├── common.ts             # Shared/reusable types
│   │   └── index.ts              # Type exports
│   │
│   ├── shared/                   # Shared utilities
│   │   ├── errors/               # Custom error classes
│   │   │   ├── base.error.ts
│   │   │   ├── api.error.ts
│   │   │   ├── validation.error.ts
│   │   │   ├── ai.error.ts
│   │   │   ├── storage.error.ts
│   │   │   └── repository.error.ts
│   │   ├── utils/                # Utility functions
│   │   │   ├── retry.util.ts    # Retry with backoff
│   │   │   ├── logger.util.ts   # Structured logging
│   │   │   └── validation.util.ts
│   │   └── constants/            # Application constants
│   │
│   ├── core/                     # Core business logic
│   │   └── repositories/         # Data access layer
│   │       ├── cache.repository.ts
│   │       ├── queue.repository.ts
│   │       ├── pipeline.repository.ts
│   │       ├── tracking.repository.ts
│   │       └── config.repository.ts
│   │
│   └── infrastructure/           # External integrations
│       ├── api/                  # API clients
│       │   ├── base.client.ts
│       │   ├── clickup.client.ts
│       │   └── github.client.ts
│       └── storage/              # Storage implementations
│           └── json-storage.ts
│
├── lib/                          # Legacy modules (being migrated)
│   ├── ui.ts
│   ├── config.ts
│   ├── clickup.ts
│   ├── github.ts
│   ├── storage.ts
│   ├── gemini.ts
│   ├── codex.ts
│   ├── claude.ts
│   ├── orchestrator.ts
│   └── ... (other modules)
│
├── forky.ts                      # Main entry point
├── dist/                         # Compiled JavaScript
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

See [src/README.md](src/README.md) for detailed architecture documentation.

### Architecture Highlights

**Layered Design:**
- **Types Layer**: Centralized, strongly-typed domain models
- **Shared Layer**: Reusable utilities, custom errors, constants
- **Core Layer**: Business logic with repository pattern
- **Infrastructure Layer**: External API clients and storage

**Key Features:**
1. **Type Safety** - Strict TypeScript with comprehensive interfaces
2. **Error Handling** - Custom error classes with context and codes
3. **Repository Pattern** - Clean data access abstraction
4. **API Client Abstraction** - Retry logic and error handling built-in
5. **Dependency Injection Ready** - Service layer foundation prepared
6. **Scalable** - Architecture supports future database migration

**Benefits:**
- ✅ Better maintainability with clear separation of concerns
- ✅ Improved testability with dependency injection
- ✅ Enhanced reliability with comprehensive error handling
- ✅ Future-proof architecture ready to scale
- ✅ Excellent IDE support with strict typing

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
