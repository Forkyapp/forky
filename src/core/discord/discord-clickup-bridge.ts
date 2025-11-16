/**
 * Discord to ClickUp Bridge
 * Converts Discord messages into ClickUp tasks
 */

import type { AnalyzedMessage } from '@/types/discord';
import type { ClickUpTask } from '@/types/clickup';
import { ClickUpClient } from '@/infrastructure/api/clickup.client';
import config from '@/shared/config';
import { CLICKUP_STATUS } from '@/shared/constants';
import { logger } from '@/shared/utils/logger.util';

export interface DiscordTaskCreationResult {
  success: boolean;
  task?: ClickUpTask;
  error?: string;
}

/**
 * Extract task title from Discord message
 * Looks for patterns like "Bug: title" or "Issue: title"
 * Falls back to first sentence or truncated content
 */
function extractTitle(message: AnalyzedMessage): string {
  const content = message.message.content;

  // Remove all Discord mentions (users and roles) from title
  const cleanContent = content
    .replace(/<@!?\d+>/g, '')      // Remove user mentions
    .replace(/<@&\d+>/g, '')       // Remove role mentions
    .replace(/<#\d+>/g, '')        // Remove channel mentions
    .trim();

  // Pattern 1: "Bug: Title here" or "Issue: Title here"
  const colonMatch = cleanContent.match(/(?:bug|issue|error|problem|fix):\s*([^\n]+)/i);
  if (colonMatch) {
    return colonMatch[1].trim().substring(0, 100);
  }

  // Pattern 2: First sentence
  const sentenceMatch = cleanContent.match(/^([^.!?\n]+)/);
  if (sentenceMatch) {
    return sentenceMatch[1].trim().substring(0, 100);
  }

  // Fallback: Truncate content
  return cleanContent.substring(0, 100).trim() || 'Untitled Discord Task';
}

/**
 * Extract task description from Discord message
 * Includes full message content and Discord link
 */
function extractDescription(message: AnalyzedMessage): string {
  const { message: msg } = message;

  // Remove Discord mentions from content
  const cleanContent = msg.content
    .replace(/<@!?\d+>/g, '')      // Remove user mentions
    .replace(/<@&\d+>/g, '')       // Remove role mentions
    .replace(/<#\d+>/g, '')        // Remove channel mentions
    .trim();

  return `
**Reported via Discord**

**Message Link:** https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}

---

${cleanContent}

${msg.attachments.length > 0 ? `\n**Attachments:**\n${msg.attachments.map(a => `- [${a.filename}](${a.url})`).join('\n')}` : ''}
`.trim();
}

/**
 * Convert priority to ClickUp priority value
 * 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
 */
function getPriorityValue(priority: string): number {
  switch (priority) {
    case 'HIGH': return 2;
    case 'MEDIUM': return 3;
    case 'LOW': return 4;
    default: return 3;
  }
}

/**
 * Determine task status based on message content
 * Returns 'bot in progress' if action keywords detected, otherwise 'to do'
 */
function determineTaskStatus(message: string): string {
  const content = message.toLowerCase();

  // Action keywords that indicate immediate work should start
  const actionKeywords = [
    'start working',
    'start work',
    'begin working',
    'begin work',
    'get started',
    'work on this',
    'work on it',
    'start this',
    'start it',
    'do this now',
    'do it now',
    'implement now',
    'fix now',
  ];

  // Check if any action keyword is present
  const hasActionKeyword = actionKeywords.some(keyword => content.includes(keyword));

  // Return appropriate status
  return hasActionKeyword ? CLICKUP_STATUS.BOT_IN_PROGRESS : CLICKUP_STATUS.TO_DO;
}

/**
 * Create ClickUp task from Discord message
 */
export async function createTaskFromDiscordMessage(
  analyzedMessage: AnalyzedMessage
): Promise<DiscordTaskCreationResult> {
  try {
    // Validate configuration
    if (!config.clickup.listId) {
      return {
        success: false,
        error: 'CLICKUP_LIST_ID not configured in .env. Discord task creation is disabled.',
      };
    }

    if (!config.clickup.apiKey) {
      throw new Error('CLICKUP_API_KEY not configured in .env');
    }

    if (!config.clickup.botUserId) {
      throw new Error('CLICKUP_BOT_USER_ID not configured in .env');
    }

    // Extract task details
    const title = extractTitle(analyzedMessage);
    const description = extractDescription(analyzedMessage);
    const priority = getPriorityValue(analyzedMessage.priority);
    const tags = ['ai created'];

    // Determine status based on message content
    const status = determineTaskStatus(analyzedMessage.message.content);

    // Create ClickUp client
    const clickupClient = new ClickUpClient({
      apiKey: config.clickup.apiKey,
    });

    // Prepare task payload
    const taskPayload = {
      name: title,
      description,
      assignees: [config.clickup.botUserId],
      status,
      priority,
      tags,
    };

    // Create task
    const task = await clickupClient.createTask(config.clickup.listId, taskPayload);

    return { success: true, task };

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create ClickUp task from Discord', err);

    return {
      success: false,
      error: err.message,
    };
  }
}
