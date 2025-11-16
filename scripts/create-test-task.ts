#!/usr/bin/env ts-node
/**
 * Create a test task in ClickUp
 * Usage: npm run create-test-task
 *
 * This script creates a test task in ClickUp to verify the integration is working correctly.
 * It uses the configured ClickUp API credentials and list ID from the environment.
 */

import { ClickUpClient } from '../src/infrastructure/api/clickup.client';
import config from '../src/shared/config';
import { timmy } from '../src/shared/ui';

async function createTestTask(): Promise<void> {
  console.log(timmy.info('🧪 Creating test task in ClickUp...'));
  console.log();

  // Get list ID from environment variable
  const listId = process.env.CLICKUP_LIST_ID;

  // Validate configuration
  if (!config.clickup.apiKey) {
    console.log(timmy.error('❌ CLICKUP_API_KEY not configured in .env'));
    console.log(timmy.info('   Please add CLICKUP_API_KEY to your .env file'));
    process.exit(1);
  }

  if (!listId) {
    console.log(timmy.error('❌ CLICKUP_LIST_ID not configured in .env'));
    console.log(timmy.info('   Please add CLICKUP_LIST_ID to your .env file'));
    console.log(timmy.info('   You can find the list ID in the URL when viewing a ClickUp list'));
    console.log(timmy.info('   Example: https://app.clickup.com/WORKSPACE_ID/v/li/LIST_ID'));
    process.exit(1);
  }

  if (!config.clickup.botUserId) {
    console.log(timmy.error('❌ CLICKUP_BOT_USER_ID not configured in .env'));
    console.log(timmy.info('   Please add CLICKUP_BOT_USER_ID to your .env file'));
    process.exit(1);
  }

  console.log(timmy.info('📋 Configuration:'));
  console.log(timmy.info(`   List ID: ${listId}`));
  console.log(timmy.info(`   Bot User ID: ${config.clickup.botUserId}`));
  console.log();

  try {
    // Create ClickUp client
    const clickupClient = new ClickUpClient({
      apiKey: config.clickup.apiKey,
    });

    // Generate timestamp for unique task name
    const timestamp = new Date().toISOString();

    // Create test task
    const task = await clickupClient.createTask(listId, {
      name: `Test Task - ${timestamp}`,
      description: `
# Test Task

This is a test task created by the \`create-test-task\` script to verify ClickUp integration.

## Details
- **Created at:** ${timestamp}
- **Created by:** Timmy Bot
- **Purpose:** Testing ClickUp API integration

## What to test
- [ ] Task appears in ClickUp list
- [ ] Task is assigned to bot user
- [ ] Task has correct status
- [ ] Task has correct priority
- [ ] Task has correct tags
- [ ] Task description is formatted correctly

## Next Steps
Once you've verified the task appears correctly in ClickUp, you can:
1. Mark this task as complete
2. Delete this task
3. Use it as a template for future tasks
      `.trim(),
      assignees: [config.clickup.botUserId],
      status: 'bot in progress',
      priority: 3, // Normal priority
      tags: ['test', 'automated', 'bot'],
    });

    console.log(timmy.success('✅ Test task created successfully!'));
    console.log();
    console.log(timmy.info('📝 Task Details:'));
    console.log(timmy.info(`   ID: ${task.id}`));
    console.log(timmy.info(`   Name: ${task.name}`));
    if (task.url) {
      console.log(timmy.info(`   URL: ${task.url}`));
    }
    console.log();
    console.log(timmy.success('🎉 You can now view this task in ClickUp to verify the integration!'));

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log(timmy.error(`❌ Failed to create test task: ${err.message}`));
    console.log();
    console.log(timmy.info('💡 Troubleshooting:'));
    console.log(timmy.info('   1. Check your CLICKUP_API_KEY is valid'));
    console.log(timmy.info('   2. Verify CLICKUP_LIST_ID exists and you have access'));
    console.log(timmy.info('   3. Ensure CLICKUP_BOT_USER_ID is correct'));
    console.log(timmy.info('   4. Check your internet connection'));
    process.exit(1);
  }
}

// Run the script
createTestTask();
