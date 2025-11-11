import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import config, { RepositoryConfig } from './config';
import { forky, colors } from './ui';
import * as clickup from './clickup';
import * as storage from './storage';
import type { ClickUpTask, LaunchOptions, FixTodoOptions, LaunchResult, FixTodoResult, Settings } from './types';

const execAsync = promisify(exec);

function ensureClaudeSettings(repoPath: string | null = null): void {
  const targetRepoPath = repoPath || config.github.repoPath;
  if (!targetRepoPath) {
    throw new Error('Repository path is not configured');
  }

  const claudeDir = path.join(targetRepoPath, '.claude');
  const settingsFile = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  const settings: Settings = {
    permissions: {
      allow: [
        'Bash(*)',
        'Read(*)',
        'Write(*)',
        'Edit(*)',
        'Glob(*)',
        'Grep(*)',
        'Task(*)',
        'WebFetch(*)',
        'WebSearch(*)',
        'NotebookEdit(*)',
        'mcp__*',
        '*'
      ],
      deny: []
    },
    hooks: {
      'user-prompt-submit': 'echo \'yes\''
    }
  };

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

async function launchClaude(task: ClickUpTask, options: LaunchOptions = {}): Promise<LaunchResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';
  const { analysis, repoConfig } = options;

  // Use provided repoConfig or fall back to legacy config
  const repoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  if (!repoPath) {
    throw new Error('Repository path is not configured');
  }

  console.log(forky.ai(`Deploying ${colors.bright}Claude${colors.reset} for ${colors.bright}${taskId}${colors.reset}: "${taskTitle}"`));
  ensureClaudeSettings(repoPath);

  // Build prompt with optional Gemini analysis
  let analysisSection = '';
  let featureDocsPath = '';

  if (analysis && analysis.content) {
    // Include feature folder location
    if (analysis.featureDir) {
      featureDocsPath = `

**FEATURE DOCUMENTATION:**
The detailed feature specification is located at:
\`${analysis.featureDir}/feature-spec.md\`

You can read this file to understand the implementation requirements, files to modify, and acceptance criteria.
`;
    }

    analysisSection = `

**GEMINI AI ANALYSIS:**
This task has been pre-analyzed by Gemini AI. Please review the analysis below for implementation guidance:

---
${analysis.content}
---

Use this analysis to guide your implementation. Follow the suggested approach and implementation steps.
${featureDocsPath}`;
  }

  const prompt = `I need you to implement a ClickUp task and create a GitHub Pull Request.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:**
${taskDescription}
${analysisSection}

**Repository Information:**
- Path: ${repoPath}
- Owner: ${repoOwner}
- Repo: ${repoName}

**Required Steps (MUST COMPLETE ALL):**

${analysis && analysis.featureDir ? `0. **Read the feature specification:**
   Read the file: ${analysis.featureDir}/feature-spec.md
   This contains detailed requirements, files to modify, and implementation guidance.

` : ''}1. **Navigate to repository:**
   cd ${repoPath}

2. **Update main branch:**
   git checkout main
   git pull origin main
   (Ensure we have latest changes)

3. **Create new branch from main:**
   git checkout -b task-${taskId}

4. **Implement the feature:**
   - Read the description carefully
   - Make all necessary code changes
   - Follow existing code style and patterns

5. **Test your changes:**
   - Run any relevant tests
   - Verify the implementation works

6. **Commit your changes:**
   git add .
   git commit -m "feat: ${taskTitle} (#${taskId})"

7. **Push to GitHub:**
   git push -u origin task-${taskId}

8. **Create Pull Request:**
   Use gh CLI to create PR (non-interactive):
   gh pr create --title "[ClickUp #${taskId}] ${taskTitle}" --body "## ClickUp Task

**Task:** ${taskTitle}
**ID:** ${taskId}
**URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

## Description
${taskDescription}

## Implementation
[Brief summary of what you implemented]

---
🤖 Automated via Forky" --base main --head task-${taskId}

**CRITICAL:**
- You MUST create the Pull Request at the end
- Do NOT skip the PR creation step
- After PR is created, respond with the PR URL

**Important Instructions:**
- Work AUTONOMOUSLY - make reasonable decisions
- Follow the repository's existing code style and patterns
- If you encounter minor issues, resolve them independently
- Install new packages without asking
- Use claude --dangerously-skip-permissions to bypass security prompts
- Use any git commands you need to complete the task
- MUST complete ALL steps including PR creation
- DO NOT leave TODO or FIXME comments in your code - implement features completely
- Codex will review your code and add TODO/FIXME comments for improvements if needed

**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin implementation now and make sure to create the PR when done!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-prompt.txt`);
    const logFile = path.join(__dirname, '..', 'logs', `${taskId}-claude.log`);
    const progressFile = path.join(__dirname, '..', 'progress', `${taskId}-claude.json`);

    fs.writeFileSync(promptFile, prompt);

    console.log(forky.info(`${colors.bright}Claude${colors.reset} starting implementation...`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Execute Claude SYNCHRONOUSLY - wait for it to complete
    // Output goes to terminal in real-time (no background process)
    const claudeCommand = `cd "${repoPath}" && (echo "y"; sleep 2; cat "${promptFile}") | claude --dangerously-skip-permissions`;

    try {
      await execAsync(claudeCommand, {
        env: cleanEnv,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 1800000 // 30 minute timeout
      });

      console.log(forky.success(`${colors.bright}Claude${colors.reset} completed implementation for ${colors.bright}task-${taskId}${colors.reset}`));

      // Cleanup prompt file
      fs.unlinkSync(promptFile);

      await clickup.addComment(
        taskId,
        `✅ **Claude Implementation Complete**\n\n` +
        `Claude has finished implementing the feature.\n\n` +
        `**Branch:** \`task-${taskId}\`\n` +
        `**Status:** Complete\n\n` +
        `Next: Pull Request should be created`
      );

      return {
        success: true,
        branch: `task-${taskId}`,
        logFile,
        progressFile
      };

    } catch (claudeError) {
      const err = claudeError as Error;
      console.log(forky.error(`${colors.bright}Claude${colors.reset} execution failed: ${err.message}`));

      // Cleanup prompt file
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }

      throw claudeError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Deployment failed: ${err.message}`));
    console.log(forky.info('Task queued for manual processing'));

    await storage.queue.add(task);

    return { success: false, error: err.message };
  }
}

async function fixTodoComments(task: ClickUpTask, options: FixTodoOptions = {}): Promise<FixTodoResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const branch = `task-${taskId}`;
  const { repoConfig } = options;

  // Use provided repoConfig or fall back to legacy config
  const repoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  if (!repoPath) {
    throw new Error('Repository path is not configured');
  }

  console.log(forky.ai(`${colors.bright}Claude${colors.reset} addressing TODO/FIXME comments for ${colors.bright}${taskId}${colors.reset}`));
  ensureClaudeSettings(repoPath);

  const prompt = `You need to address the TODO and FIXME comments that Codex added during code review.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Branch:** ${branch}

**Repository Information:**
- Path: ${repoPath}
- Owner: ${repoOwner}
- Repo: ${repoName}

**Your Task:**

1. **Checkout the branch:**
   cd ${repoPath}
   git checkout ${branch}
   git pull origin ${branch}

2. **Find all TODO and FIXME comments:**
   Search for both comment types in the codebase:
   - grep -r "FIXME:" .
   - grep -r "TODO:" .

3. **Address comments by priority:**
   a. **FIXME comments (Critical - Address FIRST):**
      - These are bugs or critical issues
      - MUST be fixed before PR can be merged
      - Read, understand, implement fix, remove comment

   b. **TODO comments (Enhancements - Address SECOND):**
      - These are improvements or nice-to-haves
      - Should be addressed if reasonable
      - Read, understand, implement, remove comment

4. **For each comment:**
   - Read and understand the issue/suggestion
   - Implement the fix or improvement
   - Remove the comment after fixing
   - Test your changes

5. **Commit your fixes:**
   git add .
   git commit -m "fix: Address TODO/FIXME comments from code review (#${taskId})"
   git push origin ${branch}

6. **Update the PR:**
   The PR will be automatically updated with your fixes.
   Add a comment summarizing what was addressed.

**Important Guidelines:**
- Address ALL FIXME comments (critical bugs)
- Address all TODO comments when possible
- Remove each comment after fixing it
- Make sure your fixes are correct and tested
- Don't skip any FIXMEs - they're critical issues
- Priority: FIXME > TODO
- If you can't fix something, leave the comment and explain why in commit message

**Example workflow:**
1. Find: \`// FIXME: This crashes when user is null\`
2. Fix: Add null check and error handling
3. Remove the FIXME comment
4. Test it works
5. Move to next FIXME/TODO

Begin addressing the comments now - FIXME comments first, then TODO!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-fix-todos-prompt.txt`);
    fs.writeFileSync(promptFile, prompt);

    console.log(forky.info(`${colors.bright}Claude${colors.reset} starting TODO/FIXME fixes...`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Execute Claude SYNCHRONOUSLY - wait for it to complete
    const claudeCommand = `cd "${repoPath}" && (echo "y"; sleep 2; cat "${promptFile}") | claude --dangerously-skip-permissions`;

    try {
      await execAsync(claudeCommand, {
        env: cleanEnv,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 1800000 // 30 minute timeout
      });

      console.log(forky.success(`${colors.bright}Claude${colors.reset} completed TODO/FIXME fixes for ${colors.bright}${branch}${colors.reset}`));

      // Cleanup prompt file
      fs.unlinkSync(promptFile);

      // Check if Claude made any changes and auto-commit/push them
      console.log(forky.info('Checking for uncommitted changes from Claude fixes...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(forky.info('Claude made changes. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${repoPath}" && git add . && git commit -m "fix: Address TODO/FIXME comments from code review (#${taskId})" && git push origin ${branch}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(forky.success('Claude fixes committed and pushed'));
        } else {
          console.log(forky.info('No changes to commit from Claude fixes'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(forky.warning(`Failed to auto-commit Claude fixes: ${err.message}`));
        // Don't fail the whole fix process if git operations fail
      }

      // Determine if changes were auto-committed
      let commitStatus = 'Changes auto-committed and pushed';
      try {
        const { stdout: finalStatus } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });
        if (finalStatus.trim()) {
          commitStatus = 'Warning: Some changes may not have been committed';
        }
      } catch {
        // Ignore status check errors
      }

      await clickup.addComment(
        taskId,
        `✅ **TODO/FIXME Fixes Complete**\n\n` +
        `Claude has addressed all TODO/FIXME comments from Codex's review.\n\n` +
        `**Branch:** \`${branch}\`\n` +
        `**Status:** ${commitStatus}\n\n` +
        `PR has been updated with all improvements`
      );

      return {
        success: true,
        branch
      };

    } catch (claudeError) {
      const err = claudeError as Error;
      console.log(forky.error(`${colors.bright}Claude${colors.reset} fix execution failed: ${err.message}`));

      // Cleanup prompt file
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }

      throw claudeError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`TODO fix failed: ${err.message}`));
    return { success: false, error: err.message };
  }
}

export {
  ensureClaudeSettings,
  launchClaude,
  fixTodoComments,
  // Types
  ClickUpTask,
  LaunchOptions,
  FixTodoOptions,
  LaunchResult,
  FixTodoResult,
  Settings
};
