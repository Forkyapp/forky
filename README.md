# Timmy - Your AI Junior Developer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

Your autonomous AI junior developer that you can chat with on Discord or assign tasks via ClickUp! Mention @Timmy in Discord to discuss bugs/features - he'll ask questions, understand the context, and automatically create tasks. Or create ClickUp tasks manually. Either way, Timmy orchestrates multiple AI services (Gemini, Claude, Codex) to analyze, implement, review, and fix code automatically - just like a real junior developer on your team!

## How It Works

### Simple Overview

**Two Ways to Assign Work to Timmy:**

```
┌─────────────────────────────────────────────────────────────────┐
│ PATH 1: Discord Bot (Primary) ✨                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. YOU: Mention @Timmy in Discord                               │
│    - Describe bug/feature in conversation                       │
│    - Timmy's AI Brain asks clarifying questions                 │
│    - Discussion happens naturally                               │
│                                                                  │
│ 2. TIMMY: Analyzes & Creates ClickUp Task                       │
│    - AI Brain understands the requirement                       │
│    - Automatically creates ClickUp task                         │
│    - Sets status to "bot in progress"                           │
│    - Task includes full context from Discord                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    [ClickUp Task Created]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PATH 2: Manual ClickUp Task                                     │
├─────────────────────────────────────────────────────────────────┤
│ YOU: Create ClickUp task manually                               │
│    - Write title and description                                │
│    - Set status to "bot in progress"                            │
│    - Timmy detects it within 60s                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    [Both Paths Merge Here]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. TIMMY: Automated Implementation Pipeline                     │
│    - Stage 1: Gemini analyzes requirements                      │
│    - Stage 2: Claude implements features                        │
│    - Stage 3: Codex reviews code (self-QA)                      │
│    - Stage 4: Claude fixes review issues                        │
│    - All automated - works independently!                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. RESULT: Ready for Senior Review                              │
│    - GitHub PR created with full implementation                 │
│    - ClickUp task updated with PR link                          │
│    - Discord notification (if started from Discord)             │
│    - Waiting for your approval to merge                         │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-AI Orchestration Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Task Detection (Every 60s)                               │
│    - Polls ClickUp for "bot in progress" tasks              │
│    - Monitors Discord channels with AI Brain (NEW!)         │
│    - GitHub issue monitoring (coming soon)                  │
│    - Deduplicates using cache                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Stage 1: Gemini Analysis                                 │
│    - Analyzes task requirements                             │
│    - Generates feature specification                        │
│    - Creates architecture recommendations                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Stage 2: Claude Implementation                           │
│    - Loads smart context from codebase                      │
│    - Implements feature based on specification              │
│    - Commits changes to feature branch                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Stage 3: Codex Code Review                               │
│    - Reviews implementation quality                         │
│    - Identifies issues and improvements                     │
│    - Generates review feedback                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Stage 4: Claude Fixes                                    │
│    - Addresses TODO/FIXME comments                          │
│    - Implements review suggestions                          │
│    - Finalizes implementation                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Pull Request Creation & Updates                         │
│    - Creates GitHub PR automatically                        │
│    - Links PR to original GitHub issue (if applicable)      │
│    - Posts PR link to ClickUp task                          │
│    - Updates task/issue status                              │
│    - Notifies via Discord (optional)                        │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Core Capabilities

- **Discord Bot with AI Brain** ✨: Chat naturally with Timmy, discuss bugs/features, and he creates ClickUp tasks automatically!
- **Two-Way Task Assignment**: Start from Discord (interactive) or ClickUp (manual) - both trigger the same automated pipeline
- **Multi-AI Orchestration Pipeline**: Gemini (analysis) → Claude (implementation) → Codex (review) → Claude (fixes)
- **Fully Autonomous**: From task creation to PR - works independently like a real junior developer
- **Smart Context Loading**: Intelligent codebase analysis for better AI understanding
- **Interactive Terminal UI**: Real-time monitoring and control of all operations
- **Multi-Project Support**: Seamlessly switch between different projects

### Planned Features 🚀

- **GitHub Issue Bot**: Auto-detect labeled issues, analyze with AI brain, implement fixes (coming Q1 2025)
- **PR Review Bot**: Automatically review incoming PRs with AI feedback
- **Slack Integration**: Extend Discord bot capabilities to Slack workspaces

### AI Services Integration

- **Gemini CLI**: Feature specification and requirement analysis
- **Claude Code CLI**: Feature implementation and code fixes
- **Codex CLI**: Code quality review and improvement suggestions
- **AI Brain**: Discord message processing with context-aware responses (powered by Claude)

### Discord Bot Features ✨ (Live Now!)

- **AI Brain Integration**: Powered by Claude for intelligent, context-aware responses
- **Interactive Task Creation**: Mention @Timmy to discuss bugs/features - he asks clarifying questions and creates ClickUp tasks automatically!
- **Natural Conversations**: Discusses requirements, asks questions, understands context like a real junior developer
- **Message Monitoring**: Real-time monitoring and logging of configured channels
- **Thread Tracking**: Maintains conversation history and context across threads
- **Smart Responses**: Provides helpful answers using codebase context
- **Channel Configuration**: Flexible channel-specific settings
- **Rate Limiting**: Built-in protection against API rate limits
- **Error Handling**: Robust error recovery and retry logic

### GitHub Bot Features 🚀 (Coming Soon)

- **Issue Detection**: Automatically detects issues labeled with "timmy" or "bot"
- **AI Analysis**: Uses AI Brain to understand issue context and requirements
- **Bug Fixing**: Analyzes stack traces, error messages, and reproduces bugs
- **Feature Implementation**: Implements feature requests from GitHub issues
- **Auto-PR Creation**: Creates pull requests linked to original issues
- **Issue Updates**: Comments on issues with progress and PR links
- **Smart Labeling**: Automatically categorizes issues (bug, feature, enhancement)
- **Context-Aware**: Loads relevant codebase context for better understanding

## Prerequisites

### Required

- **Node.js 18+**: Runtime environment
- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)**: For AI-powered implementation
- **ClickUp Account**: With API access for task management
- **GitHub Account**: With personal access token for PR creation

### Optional

- **Gemini CLI**: For advanced task analysis (falls back to basic analysis if not available)
- **Codex CLI**: For code quality review
- **Discord Bot**: For Discord channel monitoring and AI responses (see [DISCORD_SETUP.md](DISCORD_SETUP.md))
- **macOS**: Required for automatic Terminal launching feature

## Installation

```bash
git clone https://github.com/kuxala/clickup-bot.git
cd clickup-bot
npm install
npm run build
```

## Setup

**Interactive Setup (Recommended):**
```bash
npm run init
```

This interactive setup will guide you through:
- GitHub authentication (with browser or token)
- ClickUp API key configuration
- Optional OpenAI API (for RAG-based context loading)
- Optional Discord Bot (for monitoring Discord channels)
- Project configuration
- System settings

**Manual Setup:**
```bash
# 1. Copy the example environment file
cp .env.example .env

# 2. Edit .env with your credentials
#    - CLICKUP_API_KEY: Get from https://app.clickup.com/settings/apps
#    - GITHUB_TOKEN: Create at https://github.com/settings/tokens
#    - OPENAI_API_KEY: (Optional) From https://platform.openai.com/api-keys
#    - DISCORD_BOT_TOKEN: (Optional) From https://discord.com/developers/applications

# 3. Configure your projects
# Edit projects.json with your projects
nano projects.json

# 4. Switch to your project
npm run switch my-project
```

## Usage

### Starting Timmy

**Standard Mode:**
```bash
npm start
```

**Interactive Mode:**
```bash
npm run dev
```

The interactive terminal provides:
- Real-time task monitoring
- Pipeline status visualization
- Manual task reprocessing
- Discord bot status
- Interactive commands

### ClickUp Task Workflow

1. **Create a ClickUp Task:**
   - Set status to "bot in progress"
   - Add clear title and description
   - Optionally add custom fields for repository selection

2. **Automated Processing:**
   - Timmy detects task within 60s
   - **Stage 1**: Gemini analyzes requirements
   - **Stage 2**: Claude implements features
   - **Stage 3**: Codex reviews code
   - **Stage 4**: Claude fixes issues
   - **Stage 5**: PR is created automatically

3. **Review:**
   - Check the generated PR on GitHub
   - Review changes and merge when ready
   - ClickUp task is updated with PR link

### Discord Bot Usage ✨ (Live Now!)

**Setup:**
See [DISCORD_SETUP.md](DISCORD_SETUP.md) for detailed configuration.

**How to Use:**
1. **Add Timmy to Your Discord Server**
   - Invite the bot using the Discord app
   - Configure monitored channels in `.env`
   - Enable AI Brain for intelligent responses

2. **Interact with Timmy:**
   - Mention @Timmy and describe your bug or feature request
   - Timmy asks clarifying questions in the conversation
   - Once clear, Timmy creates a ClickUp task automatically
   - The automated pipeline starts working on it!

3. **Example Interaction:**
   ```
   You: "@Timmy we need to add user authentication to the app"
   Timmy: "I can help with that! A few questions:
          - What auth method? (JWT, OAuth, session-based?)
          - Do you need social login (Google, GitHub)?
          - Any specific security requirements?"

   You: "JWT with email/password, no social login for now"
   Timmy: "Got it! Creating ClickUp task and starting implementation..."
          *Creates task and begins automated pipeline*
   ```

**Configuration:**
```bash
# .env file
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CHANNEL_IDS=channel1,channel2
DISCORD_AI_ENABLED=true  # Enable AI Brain
```

### GitHub Issue Workflow 🚀 (Coming Soon)

1. **Create or Label a GitHub Issue:**
   - Create a new issue describing the bug or feature
   - Add label "timmy" or "bot" to assign it to Timmy
   - Include details: description, steps to reproduce, expected behavior

2. **Automated Processing:**
   - Timmy detects labeled issue within 60s
   - **Stage 1**: AI Brain analyzes issue and context
   - **Stage 2**: Claude implements fix or feature
   - **Stage 3**: Codex reviews the implementation
   - **Stage 4**: Claude addresses review feedback
   - **Stage 5**: PR is created and linked to issue

3. **Review & Merge:**
   - GitHub PR is linked to original issue
   - Timmy comments on issue with PR link and summary
   - Review changes and approve
   - Issue auto-closes when PR is merged

**Supported Issue Types:**
- 🐛 **Bug Reports**: Analyzes stack traces, reproduces bugs, implements fixes
- ✨ **Feature Requests**: Understands requirements, implements new features
- 🔧 **Enhancements**: Improves existing functionality
- 📝 **Documentation**: Updates docs, adds comments, creates guides
- ♻️ **Refactoring**: Restructures code while maintaining functionality

### Project Management

```bash
npm run projects        # List all projects
npm run switch <name>   # Switch active project
npm run current         # Show current project
```

### Interactive Commands

When running in interactive mode:
- `s` - Show current status
- `q` - View task queue
- `r <taskId>` - Rerun task
- `h` - Show help
- `Ctrl+C` - Graceful shutdown

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

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive codebase guide for AI assistants (1400+ lines)
- **[DISCORD_SETUP.md](DISCORD_SETUP.md)** - Discord bot setup and configuration
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[REPORT.md](REPORT.md)** - Detailed codebase analysis report
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide

## Important Notes

### Current Capabilities

- **Discord-First Workflow** ✨: Mention @Timmy, discuss requirements naturally, he asks questions and creates tasks automatically!
- **Two Entry Points**: Discord (interactive + auto task creation) or ClickUp (manual task creation) - both work seamlessly
- **Multi-AI Pipeline**: Fully autonomous through 4 stages (Analysis → Implementation → Review → Fixes)
- **Real Junior Developer Behavior**: Asks clarifying questions, understands context, works independently
- **End-to-End Automation**: From Discord conversation → ClickUp task → Implementation → PR
- **Multi-Project Support**: Manage multiple projects with easy switching

### Limitations

- **macOS Terminal Launching**: Automatic Terminal launching requires macOS (uses osascript)
- **Sequential Processing**: Tasks processed one at a time with 60s polling intervals
- **Computer Must Run**: Continuous operation required (use pm2 for background execution)
- **API Rate Limits**: Subject to ClickUp (100 req/min) and GitHub (5000 req/hr) limits

### Best Practices

- **Clear Task Descriptions**: Write detailed, specific task requirements for better AI analysis
- **Review PRs**: Always review generated code before merging
- **Use pm2**: Run in background for production use
- **Monitor Logs**: Check logs regularly for errors or issues
- **Test AI CLIs**: Ensure Gemini, Claude, and Codex CLIs are properly installed
- **Discord Rate Limits**: Be aware of Discord API rate limits when using bot features

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT License - see [LICENSE](LICENSE)
