/**
 * AI Brain Service
 * Provides conversational AI capabilities for Timmy to chat with users
 * Uses GPT-4o-mini for cost-effective interactions
 */

import OpenAI from 'openai';
import config from '@/shared/config';
import { logger } from '@/shared/utils/logger.util';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  userId: string;
  channelId: string;
  messages: ChatMessage[];
  lastUpdated: Date;
}

export class AIBrainService {
  private openai: OpenAI;
  private conversations: Map<string, ConversationContext> = new Map();
  private readonly systemPrompt = `You are Timmy, an intelligent autonomous task automation assistant integrated with ClickUp and GitHub.

Your capabilities:
- Automatically create ClickUp tasks when keywords like "bug", "issue", "error", "create", or "task" are detected
- Tasks are assigned to me and I'll implement fixes automatically through my AI pipeline
- Be friendly, direct, and professional

Guidelines:
- Keep responses VERY SHORT (1-2 sentences max)
- Be helpful and conversational
- Don't repeat task creation confirmations (they're sent automatically)
- Answer questions about my capabilities or help with task-related questions
- Be direct and action-oriented
- Use emojis sparingly

Current context: You're monitoring Discord channels for task requests and bug reports.`;

  constructor() {
    if (!config.openai?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    // Clean up old conversations every hour
    setInterval(() => this.cleanupOldConversations(), 60 * 60 * 1000);
  }

  /**
   * Chat with the AI brain
   */
  async chat(
    userId: string,
    channelId: string,
    message: string
  ): Promise<string> {
    try {
      // Get or create conversation context
      const contextKey = `${channelId}-${userId}`;
      let context = this.conversations.get(contextKey);

      if (!context) {
        context = {
          userId,
          channelId,
          messages: [
            {
              role: 'system',
              content: this.systemPrompt,
            },
          ],
          lastUpdated: new Date(),
        };
        this.conversations.set(contextKey, context);
      }

      // Add user message to context
      context.messages.push({
        role: 'user',
        content: message,
      });

      // Limit conversation history to last 10 messages (+ system prompt)
      if (context.messages.length > 11) {
        context.messages = [
          context.messages[0], // Keep system prompt
          ...context.messages.slice(-10), // Keep last 10 messages
        ];
      }

      // Call OpenAI API with GPT-4o-mini
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Cheap and fast
        messages: context.messages,
        max_tokens: 150, // Keep responses short
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.';

      // Add assistant response to context
      context.messages.push({
        role: 'assistant',
        content: response,
      });

      context.lastUpdated = new Date();

      // Silent logging - only detailed info for debugging
      logger.debug('AI brain responded', {
        userId,
        channelId,
        tokensUsed: completion.usage?.total_tokens,
      });

      return response;
    } catch (error) {
      const err = error as Error;
      logger.error('AI brain chat failed', err);
      return 'I apologize, I encountered an error processing your message. Please try again.';
    }
  }

  /**
   * Analyze a message to extract task requirements
   */
  async analyzeTaskRequirements(message: string): Promise<{
    hasEnoughInfo: boolean;
    summary: string;
    missingInfo: string[];
  }> {
    try {
      const analysisPrompt = `Analyze this user message and determine if it contains enough information to create a clear task:

Message: "${message}"

Respond in JSON format:
{
  "hasEnoughInfo": true/false,
  "summary": "Brief summary of what the user wants",
  "missingInfo": ["list", "of", "missing", "details"]
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing task requirements. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(response);

      return {
        hasEnoughInfo: analysis.hasEnoughInfo || false,
        summary: analysis.summary || 'Unable to analyze',
        missingInfo: analysis.missingInfo || [],
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Task requirement analysis failed', err);
      return {
        hasEnoughInfo: false,
        summary: 'Error analyzing requirements',
        missingInfo: ['Could not analyze message'],
      };
    }
  }

  /**
   * Clear conversation history for a user
   */
  clearConversation(userId: string, channelId: string): void {
    const contextKey = `${channelId}-${userId}`;
    this.conversations.delete(contextKey);
    logger.info('Conversation cleared', { userId, channelId });
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    activeConversations: number;
    totalMessages: number;
  } {
    let totalMessages = 0;
    for (const context of this.conversations.values()) {
      totalMessages += context.messages.length;
    }

    return {
      activeConversations: this.conversations.size,
      totalMessages,
    };
  }

  /**
   * Cleanup conversations older than 1 hour
   */
  private cleanupOldConversations(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleaned = 0;

    for (const [key, context] of this.conversations.entries()) {
      if (context.lastUpdated < oneHourAgo) {
        this.conversations.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old conversations', { count: cleaned });
    }
  }
}

// Export singleton instance
export const aiBrainService = new AIBrainService();
