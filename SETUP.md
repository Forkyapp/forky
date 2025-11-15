# Timmy Setup Guide

Complete step-by-step guide to set up Timmy from scratch.

## What is Timmy?

Timmy watches your ClickUp tasks and automatically:
1. Detects tasks marked "bot in progress"
2. Uses AI to analyze and implement the feature
3. Creates a GitHub pull request
4. (Optional) Monitors Discord for bug reports

---

## Quick Setup (5 minutes)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Run Interactive Setup

```bash
npm run init
```

Follow the prompts - it will set up everything for you!

**Done! Skip to [Running Timmy](#step-6-run-timmy)**

---

## Manual Setup (Step-by-Step)

### Step 1: Install Dependencies

```bash
cd timmy
npm install
```

### Step 2: Install Claude Code CLI

**Required** - Claude implements your code

```bash
# Install (macOS/Linux)
curl -sSL https://install.anthropic.com/claude-code | bash

# Authenticate
claude auth login

# Verify
claude --version
```

### Step 3: Set Up ClickUp

**Get your API credentials:**

1. **API Key**
   - Go to: https://app.clickup.com/settings/apps
   - Click "Generate" under API Token
   - Copy the key (starts with `pk_`)

2. **Workspace ID**
   ```bash
   curl -H "Authorization: YOUR_API_KEY" https://api.clickup.com/api/v2/team
   ```
   Copy the `id` from response

3. **User ID**
   - Go to: https://app.clickup.com/settings/profile
   - Copy ID from URL: `.../profile/YOUR_USER_ID`

4. **Create Status**
   - In ClickUp: Settings → Statuses → Add Status
   - Name: `bot in progress`

### Step 4: Set Up GitHub

**Option A - GitHub CLI (Recommended):**

```bash
# Install (macOS)
brew install gh

# Or Linux: https://cli.github.com/manual/installation

# Login
gh auth login
```

**Option B - Personal Access Token:**

1. Go to: https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Copy token (starts with `ghp_`)

**Clone your repository:**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git ~/projects/your-repo
```

### Step 5: Create .env File

Create `.env` in the timmy directory:

```bash
# ============================================
# REQUIRED
# ============================================

# ClickUp
CLICKUP_API_KEY=your_clickup_api_key_here
CLICKUP_WORKSPACE_ID=12345678
CLICKUP_BOT_USER_ID=87654321

# GitHub
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name
GITHUB_REPO_PATH=/Users/you/projects/your-repo
GITHUB_BASE_BRANCH=main

# ============================================
# OPTIONAL - Discord Bot
# ============================================

DISCORD_ENABLED=false
# DISCORD_BOT_TOKEN=your_discord_bot_token_here
# DISCORD_GUILD_ID=123456789012345678
# DISCORD_CHANNEL_IDS=123456789012345678,987654321098765432
# DISCORD_KEYWORDS=bug,issue,error,problem,broken,crash,fix
# DISCORD_POLL_INTERVAL_MS=600000

# ============================================
# OPTIONAL - OpenAI (for Discord AI responses & RAG context loading)
# ============================================

# OPENAI_API_KEY=your_openai_api_key_here

# ============================================
# OPTIONAL - Context Loading (RAG System)
# ============================================

# Context loading mode: free (Smart Loader only), premium (RAG only), hybrid (RAG with fallback)
# CONTEXT_MODE=hybrid

# Enable fallback to Smart Loader if RAG fails (default: true)
# CONTEXT_FALLBACK=true

# Enable context caching (default: true)
# CONTEXT_CACHE_ENABLED=true

# Context cache TTL in seconds (default: 3600 = 1 hour)
# CONTEXT_CACHE_TTL=3600

# ============================================
# OPTIONAL - System Config (defaults work fine)
# ============================================

# POLL_INTERVAL_MS=60000
# CLAUDE_CLI_PATH=claude
# GEMINI_CLI_PATH=gemini
# CODEX_CLI_PATH=codex
```

### Step 5b: Initialize Data Directories

```bash
# Create directories
mkdir -p data/cache data/state data/tracking data/discord

# Initialize state files
echo '{}' > data/cache/processed-tasks.json
echo '{"pending":[],"completed":[]}' > data/state/task-queue.json
echo '{}' > data/state/pipeline-state.json
echo '{}' > data/tracking/pr-tracking.json
echo '[]' > data/discord/processed-messages.json
```

### Step 6: Run Timmy

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

You should see:
```
🤖 Timmy started
✓ Connected to ClickUp
✓ Monitoring workspace: 12345678
⏱  Polling every 60 seconds...
```

### Step 7: Test It!

**Create a test task in ClickUp:**

1. Title: `Test: Add hello function`
2. Description: `Create a simple function that returns "Hello World"`
3. Set status to: `bot in progress`

**Watch Timmy work:**
- It will detect the task
- Claude will implement the code
- A PR will be created on GitHub
- PR link posted to ClickUp task

---

## Optional: Discord Bot Setup

Want Timmy to monitor Discord for bug reports?

### 1. Create Discord Bot

1. Go to: https://discord.com/developers/applications
2. "New Application" → Name it "Timmy"
3. Go to "Bot" tab → "Add Bot"
4. Enable under "Privileged Gateway Intents":
   - ✅ Message Content Intent
   - ✅ Server Members Intent
5. Copy bot token

### 2. Invite Bot to Your Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`
3. Select permissions:
   - Send Messages
   - Read Message History
   - View Channels
4. Copy URL and open it to invite bot

### 3. Get IDs

Enable Developer Mode: Discord Settings → Advanced → Developer Mode

- Right-click server → Copy ID (Guild ID)
- Right-click channels → Copy ID (Channel IDs)

### 4. Update .env

```bash
DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id
DISCORD_CHANNEL_IDS=channel1_id,channel2_id

# Optional: For AI-powered responses
OPENAI_API_KEY=your_openai_api_key_here
```

### 5. Test Discord

1. Restart Timmy
2. Send message in monitored channel: "We have a bug in the login"
3. Timmy detects it and creates ClickUp task
4. If OpenAI configured, bot responds to @mentions

---

## Optional: Multi-Project Setup

Work with multiple repositories.

### 1. Create projects.json

```json
{
  "projects": {
    "my-app": {
      "name": "My App",
      "description": "Main application",
      "clickup": {
        "workspaceId": "12345678"
      },
      "github": {
        "owner": "myorg",
        "repo": "my-app",
        "path": "/Users/me/projects/my-app",
        "baseBranch": "main"
      }
    },
    "other-app": {
      "name": "Other App",
      "description": "Second project",
      "clickup": {
        "workspaceId": "87654321"
      },
      "github": {
        "owner": "myorg",
        "repo": "other-app",
        "path": "/Users/me/projects/other-app",
        "baseBranch": "main"
      }
    }
  }
}
```

### 2. Create workspace.json

```json
{
  "active": "my-app"
}
```

### 3. Switch Projects

```bash
npm run projects       # List all
npm run switch my-app  # Switch active project
npm run current        # Show current
```

---

## Optional: Install Gemini & Codex

These are optional but add extra capabilities:

### Gemini CLI (better task analysis)

```bash
# Install - see https://ai.google.dev/gemini-api/docs/cli
gemini auth login
```

### Codex CLI (code review)

```bash
# Install - see https://codex.so/docs/cli
codex auth login
```

If installed, Timmy will use them automatically!

---

## How Timmy Works

```
1. Poll ClickUp every 60s
   ↓
2. Find tasks with status "bot in progress"
   ↓
3. Run pipeline:
   • Gemini analyzes (optional)
   • Claude implements code
   • Codex reviews (optional)
   • Claude fixes issues
   ↓
4. Create GitHub PR
   ↓
5. Post PR link to ClickUp
```

---

## Troubleshooting

### ClickUp not connecting

```bash
# Test your API key
curl -H "Authorization: YOUR_API_KEY" https://api.clickup.com/api/v2/team

# Should return your workspaces
```

### GitHub not connecting

```bash
# With GitHub CLI
gh auth status

# With token
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
```

### Claude not found

```bash
# Check if installed
which claude

# If not in PATH, add full path to .env:
CLAUDE_CLI_PATH=/full/path/to/claude
```

### No tasks detected

- Status must be exactly: `bot in progress`
- Check workspace ID matches
- Task must be in the specified workspace

### Discord bot silent

- Check `DISCORD_ENABLED=true`
- Verify bot token is correct
- Bot needs permissions in channels
- Check channel IDs are correct

---

## Environment Variables Quick Reference

### Must Have

```bash
CLICKUP_API_KEY=your_clickup_api_key
CLICKUP_WORKSPACE_ID=12345678
CLICKUP_BOT_USER_ID=12345678
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=username
GITHUB_REPO=repo-name
GITHUB_REPO_PATH=/absolute/path/to/repo
```

### Nice to Have

```bash
# Discord
DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CHANNEL_IDS=id1,id2

# OpenAI (for Discord AI)
OPENAI_API_KEY=your_openai_key

# Tweaks
POLL_INTERVAL_MS=60000          # How often to check ClickUp
GITHUB_BASE_BRANCH=main         # Default branch
```

---

## Project Structure

```
timmy/
├── .env                    # Your secrets (never commit!)
├── workspace.json          # Active project
├── projects.json           # Multiple projects
├── data/                   # Runtime state (gitignored)
│   ├── cache/             # Processed tasks
│   ├── state/             # Pipeline progress
│   ├── tracking/          # PR tracking
│   └── discord/           # Discord messages
├── src/                   # Source code
└── scripts/               # Helper scripts
```

---

## Ready to Go Checklist

- [ ] Node.js 18+ installed
- [ ] `npm install` done
- [ ] Claude CLI installed & authenticated
- [ ] ClickUp API key obtained
- [ ] GitHub authenticated (CLI or token)
- [ ] `.env` file created with all required vars
- [ ] Data directories created
- [ ] Repository cloned locally
- [ ] ClickUp status "bot in progress" exists

**Optional:**
- [ ] Discord bot created & invited
- [ ] OpenAI API key (for Discord AI)
- [ ] Gemini CLI (better analysis)
- [ ] Codex CLI (code review)

---

## Commands

```bash
npm run dev          # Run in development mode
npm run build        # Build for production
npm start            # Run production build
npm run init         # Interactive setup wizard
npm run projects     # List all projects
npm run switch <name># Switch active project
npm run current      # Show current project
```

---

## Need Help?

- **Docs**: See `CLAUDE.md` for architecture details
- **Issues**: https://github.com/Forkyapp/Timmy/issues
- **Logs**: Console shows detailed progress

---

**Last Updated**: 2025-11-15
