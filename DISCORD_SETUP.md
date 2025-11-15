# Discord Integration Guide

This guide explains how to set up and use Timmy's Discord integration to automatically monitor Discord channels for bug reports and issues.

## Overview

Timmy can monitor specific Discord server channels and detect messages containing keywords like "bug", "issue", "error", etc. When matched messages are found, they can be automatically processed and converted into tasks.

## Features

- **Selective Channel Monitoring**: Monitor only specific channels, not the entire server
- **Keyword Detection**: Configurable keywords to identify relevant messages
- **Message Priority**: Automatically prioritize messages based on keywords
- **Duplicate Prevention**: Tracks processed messages to avoid duplicates
- **Polling-based**: Polls at configurable intervals (10 min - 1 hour recommended)
- **Event-driven**: Emits events when keyword matches are found

## Setup

### Step 1: Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Give it a name (e.g., "Timmy Bot")
4. Go to **"Bot"** tab
5. Click **"Add Bot"**
6. **Important**: Enable these Privileged Gateway Intents:
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
7. Click **"Reset Token"** and copy the bot token
8. Save this token for `.env` configuration

### Step 2: Add Bot to Your Server

1. Go to **"OAuth2"** > **"URL Generator"**
2. Select scopes:
   - ✅ `bot`
3. Select bot permissions:
   - ✅ Read Messages/View Channels
   - ✅ Read Message History
4. Copy the generated URL
5. Open the URL in browser and add bot to your server
6. Select the server and authorize

### Step 3: Get Channel IDs

1. Enable Developer Mode in Discord:
   - User Settings > Advanced > Developer Mode (turn ON)
2. Right-click on the server icon > **Copy ID** (this is your Guild ID)
3. Right-click on each channel you want to monitor > **Copy ID**
4. Save these IDs for `.env` configuration

### Step 4: Configure Environment Variables

Edit your `.env` file:

```bash
# Enable Discord integration
DISCORD_ENABLED=true

# Bot token from Step 1
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Server (guild) ID from Step 3
DISCORD_GUILD_ID=1234567890123456789

# Channel IDs to monitor (comma-separated)
DISCORD_CHANNEL_IDS=1234567890123456789,9876543210987654321

# Keywords to detect (comma-separated, case-insensitive)
DISCORD_KEYWORDS=bug,issue,error,problem,broken,crash,fix,urgent

# Poll interval (10 minutes = 600000ms)
DISCORD_POLL_INTERVAL_MS=600000
```

### Step 5: Test the Integration

```bash
# Build the project
npm run build

# Start Timmy
npm start
```

You should see:
```
🔵 Discord bot monitoring started
```

## Usage

### Basic Usage

Once configured, Timmy will:

1. **Connect** to Discord when started
2. **Poll** configured channels at specified intervals
3. **Detect** messages containing keywords
4. **Prioritize** messages based on keyword severity
5. **Track** processed messages to avoid duplicates
6. **Emit events** for matched messages (for integration with other systems)

### Message Priority Levels

Messages are automatically prioritized:

**HIGH Priority** (Critical issues):
- Keywords: `crash`, `error`, `critical`, `urgent`, `broken`

**MEDIUM Priority** (Issues):
- Keywords: `bug`, `issue`, `problem`, `fix`

**LOW Priority** (Feature requests):
- Keywords: `feature`, `suggestion`, `enhancement`

### Example Discord Messages Detected

✅ **Will be detected:**
```
"Hey team, there's a critical bug in the login system"
"Users are reporting an error when uploading files"
"The app crashes when clicking the submit button"
"Can we fix this issue with the dashboard?"
```

❌ **Will NOT be detected:**
```
"Great work everyone!"
"When is the next meeting?"
"I updated the documentation"
```

## Configuration Options

### Poll Interval

Choose based on your needs:

- **10 minutes** (`600000`): Good balance, recommended
- **30 minutes** (`1800000`): Less frequent, lower load
- **1 hour** (`3600000`): Minimal polling, best for low-traffic channels

**Note**: Discord has rate limits. Don't poll more frequently than 5 minutes.

### Custom Keywords

Customize keywords based on your team's language:

```bash
# English
DISCORD_KEYWORDS=bug,issue,error,problem,broken

# Add domain-specific terms
DISCORD_KEYWORDS=bug,issue,error,timeout,performance,memory leak

# Multiple languages
DISCORD_KEYWORDS=bug,issue,fehler,problema,错误
```

### Channel Selection

Best practices for channel selection:

✅ **Good channels to monitor:**
- `#bug-reports`
- `#support`
- `#issues`
- `#feedback`
- `#qa-testing`

❌ **Avoid monitoring:**
- `#general` (too noisy)
- `#random` (off-topic)
- `#announcements` (one-way)
- Personal DMs (not supported)

## Integration with Timmy Pipeline

### Event Handling

You can listen to Discord events and integrate with the Timmy pipeline:

```typescript
import { discordService } from '@/core/discord/discord.service';

// Initialize Discord service
await discordService.init();

// Listen for detected messages
discordService.on({
  onMessageDetected: async (analyzed) => {
    console.log('Keyword match found:', {
      author: analyzed.message.author.username,
      keywords: analyzed.matches.map(m => m.keyword),
      priority: analyzed.priority,
      content: analyzed.extractedContext
    });

    // TODO: Create ClickUp task from Discord message
    // await createClickUpTask(analyzed);
  },

  onError: (error) => {
    console.error('Discord error:', error);
  },

  onReady: () => {
    console.log('Discord bot connected');
  }
});

// Start polling
discordService.startPolling();
```

### Statistics

Get statistics about processed messages:

```typescript
const stats = await discordService.getStats();
console.log('Discord Statistics:', {
  totalProcessed: stats.totalProcessed,
  processedToday: stats.processedToday,
  matchedToday: stats.matchedToday
});
```

## Data Storage

Processed messages are tracked in:

```
data/
└── discord/
    └── processed-messages.json
```

**Format:**
```json
[
  {
    "messageId": "1234567890123456789",
    "channelId": "9876543210987654321",
    "processedAt": "2025-11-15T10:30:00Z",
    "keywords": ["bug", "error"]
  }
]
```

**Automatic Cleanup:**
- Messages older than 30 days are automatically removed
- Prevents file from growing indefinitely

## Troubleshooting

### Bot Not Connecting

**Error**: `Discord client not ready`

**Solutions:**
1. Check bot token is correct
2. Verify bot is added to the server
3. Ensure intents are enabled (Step 1)
4. Check internet connection

### No Messages Detected

**Possible causes:**
1. Channel IDs are incorrect
   - Solution: Re-copy channel IDs with Developer Mode enabled
2. Keywords don't match
   - Solution: Check message content against keyword list
3. Messages are from bots
   - Note: Bot messages are automatically skipped
4. Messages already processed
   - Solution: Check `data/discord/processed-messages.json`

### Rate Limiting

**Error**: `429 Too Many Requests`

**Solutions:**
1. Increase poll interval
2. Reduce number of monitored channels
3. Wait for rate limit to reset (usually 1 hour)

### Missing Permissions

**Error**: `Missing Permissions` or `403 Forbidden`

**Solutions:**
1. Verify bot has these permissions:
   - Read Messages/View Channels
   - Read Message History
2. Check channel-specific permissions
3. Re-invite bot with correct permissions

## Advanced Features

### Cleanup Old Messages

Manually clean up old processed messages:

```typescript
import { DiscordMessageRepository } from '@/core/repositories/discord-message.repository';
import config from '@/shared/config';

const repo = new DiscordMessageRepository(config.files.discordMessagesFile);
await repo.init();

// Remove messages older than 7 days
await repo.cleanup(7);
```

### Fetch and Analyze Without Polling

Test keyword detection without starting the polling service:

```typescript
import { discordService } from '@/core/discord/discord.service';

await discordService.init();

const analyzed = await discordService.fetchAndAnalyze();
console.log('Found messages:', analyzed.length);

analyzed.forEach(msg => {
  console.log({
    author: msg.message.author.username,
    keywords: msg.matches.map(m => m.keyword),
    priority: msg.priority
  });
});
```

## Security Best Practices

1. **Never commit `.env` file** - Contains bot token
2. **Use environment-specific bots** - Different tokens for dev/prod
3. **Limit bot permissions** - Only grant necessary permissions
4. **Monitor bot activity** - Check logs for suspicious activity
5. **Rotate tokens regularly** - Change bot token periodically
6. **Use private channels** - Don't expose sensitive info in public channels

## API Rate Limits

Discord API rate limits:

- **Global**: 50 requests per second
- **Per Channel**: 5 requests per 5 seconds
- **Message Fetch**: 50 requests per 5 seconds

**Timmy's approach:**
- Polls at 10+ minute intervals (well below limits)
- Fetches max 50 messages per channel per poll
- Built-in retry logic with exponential backoff

## Future Enhancements

Planned features:

- [ ] AI-powered message analysis (extract issue details)
- [ ] Automatic ClickUp task creation from Discord messages
- [ ] Thread support (monitor message threads)
- [ ] Reaction-based filtering (only process messages with 👍 reactions)
- [ ] User mentions (notify specific users)
- [ ] Discord slash commands (manual task creation)
- [ ] Multi-server support
- [ ] Webhook integration (real-time instead of polling)

## References

- [Discord Developer Portal](https://discord.com/developers/docs)
- [discord.js Documentation](https://discord.js.org/)
- [Discord Bot Best Practices](https://discord.com/developers/docs/topics/community-resources)
- [Discord API Rate Limits](https://discord.com/developers/docs/topics/rate-limits)

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review Discord bot setup in [Developer Portal](https://discord.com/developers/applications)
3. Check Timmy logs for error messages
4. Open an issue on GitHub

---

**Last Updated**: 2025-11-15
