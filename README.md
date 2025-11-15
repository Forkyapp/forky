# Timmy - ClickUp to Claude Code Integration

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

Automates ClickUp task detection and launches Claude Code to implement features autonomously.

## How It Works

```
┌──────────────────────────────────────────┐
│ 1. YOU: Assign ClickUp Task             │
│    - Set status: "bot in progress"      │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│ 2. TIMMY: Polls ClickUp (every 60s)     │
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

## Features

- Automated ClickUp task polling (60s intervals)
- Automatic Claude Code session launching (macOS)
- AI-powered feature implementation
- GitHub integration with PR creation
- Multi-project support
- TypeScript with full type safety

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- ClickUp account with API access
- GitHub account with personal access token
- macOS (for automatic Terminal launching)

## Installation

```bash
git clone https://github.com/kuxala/clickup-bot.git
cd clickup-bot
npm install
npm run build
```

## Setup

**Interactive (Recommended):**
```bash
npm run init
```

**Manual:**
```bash
npm run setup
# Edit .env with your credentials
# Edit projects.json with your projects
npm run switch my-project
```

## Usage

**Start Timmy:**
```bash
npm start
```

**Create a ClickUp Task:**
1. Set status to "bot in progress"
2. Add clear title and description
3. Timmy detects it (within 60s)
4. Claude Code launches automatically
5. PR is created when done

**Project Management:**
```bash
npm run projects        # List all
npm run switch <name>   # Switch project
npm run current         # Show active
```

## Data Storage

All state stored in `data/` directory:

```
data/
├── cache/              # Processed tasks/comments
├── state/              # Task queue, pipeline state
└── tracking/           # PR and review tracking
```

**Initialize:**
```bash
for f in data/**/*.example; do cp "$f" "${f%.example}"; done
```

## Architecture

**Structure:**
```
src/
├── types/              # TypeScript definitions
├── shared/             # Utilities, errors, constants
├── core/               # Business logic, repositories
└── infrastructure/     # API clients, storage

lib/                    # Legacy code (migrating)
```

**Commands:**
```bash
npm run build          # Compile TypeScript
npm run dev            # Run with ts-node
npm test               # Run tests
npm run clean          # Clean build
```

## Troubleshooting

**Tasks not detected:**
- Verify status is exactly "bot in progress"
- Check credentials in `.env`
- Confirm correct user ID

**Background execution:**
```bash
# Using pm2
pm2 start npm --name timmy -- start

# Using nohup
nohup npm start > timmy.log 2>&1 &
```

## Important Notes

**Limitations:**
- macOS only (uses osascript)
- Computer must stay running
- Sequential task processing (60s intervals)

**Best Practices:**
- Write detailed task descriptions
- Review PRs before merging
- Use pm2 for background operation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT License - see [LICENSE](LICENSE)
