import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec, spawn, ChildProcess } from 'child_process';
import config from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { logger } from '../../shared/utils/logger.util';
import { loadContextForModel } from '../context/context-orchestrator';
import * as clickup from '../../../lib/clickup';
import * as storage from '../../../lib/storage';
import type { ClickUpTask } from '../../../src/types/clickup';
import type {
  ExecWithPTYOptions,
  LaunchOptions,
  ReviewOptions,
  LaunchResult,
  ReviewResult,
  Settings,
  ErrorWithCode
} from '../../../src/types/ai';
import type { ExecResult } from '../../../src/types/common';

const execAsync = promisify(exec);

/**
 * Execute a command with a pseudo-TTY using spawn
 */
function execWithPTY(command: string, options: ExecWithPTYOptions = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const shell: ChildProcess = spawn('bash', ['-c', command], {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (shell.stdout) {
      shell.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        process.stdout.write(data); // Show live output
      });
    }

    if (shell.stderr) {
      shell.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        process.stderr.write(data); // Show live errors
      });
    }

    shell.on('error', (error: Error) => {
      reject(error);
    });

    shell.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}`) as ErrorWithCode;
        error.code = code ?? undefined;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    // Send input to stdin if we're piping a file
    if (options.stdinFile && shell.stdin) {
      const inputContent = fs.readFileSync(options.stdinFile, 'utf8');
      shell.stdin.write('y\n');
      setTimeout(() => {
        if (shell.stdin) {
          shell.stdin.write(inputContent);
          shell.stdin.end();
        }
      }, 2000);
    }
  });
}

function ensureCodexSettings(repoPath: string | null = null): void {
  const targetRepoPath = repoPath || config.github.repoPath;
  if (!targetRepoPath) {
    throw new Error('Repository path is not configured');
  }

  const codexDir = path.join(targetRepoPath, '.claude');
  const settingsFile = path.join(codexDir, 'settings.json');

  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true });
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

async function launchCodex(task: ClickUpTask, options: LaunchOptions = {}): Promise<LaunchResult> {
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

  console.log(timmy.ai(`Deploying ${colors.bright}Codex${colors.reset} for ${colors.bright}${taskId}${colors.reset}: "${taskTitle}"`));
  ensureCodexSettings(repoPath);

  // Load context based on task (uses RAG if available, falls back to Smart Loader)
  console.log(timmy.info('Loading relevant coding guidelines...'));
  const smartContext = await loadContextForModel({
    model: 'codex',
    taskDescription: `${taskTitle}\n\n${taskDescription}`,
    topK: 5,
    minRelevance: 0.7
  });

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

  const prompt = `${smartContext ? smartContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}I need you to implement a ClickUp task and create a GitHub Pull Request.

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
🤖 Automated via Forky (Codex)" --base main --head task-${taskId}

**CRITICAL:**
- You MUST create the Pull Request at the end
- Do NOT skip the PR creation step
- After PR is created, respond with the PR URL

**Important Instructions:**
- Work AUTONOMOUSLY - make reasonable decisions
- Follow the repository's existing code style and patterns
- If you encounter minor issues, resolve them independently
- Install new packages without asking
- Use any git commands you need to complete the task
- MUST complete ALL steps including PR creation

**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin implementation now and make sure to create the PR when done!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-codex-prompt.txt`);
    fs.writeFileSync(promptFile, prompt);

    console.log(timmy.info(`${colors.bright}Codex${colors.reset} starting implementation...`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Create input file with 'y' confirmation and prompt
    const inputFile = path.join(__dirname, '..', `task-${taskId}-codex-input.txt`);
    const promptContent = fs.readFileSync(promptFile, 'utf8');
    fs.writeFileSync(inputFile, `y\n${promptContent}`);

    // Execute Codex SYNCHRONOUSLY - wait for it to complete
    // Use codex exec with full-auto for non-interactive execution
    const codexCommand = `cd "${repoPath}" && codex exec --full-auto --sandbox danger-full-access < "${inputFile}"`;

    try {
      await execAsync(codexCommand, {
        env: cleanEnv,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 1800000 // 30 minute timeout
      });

      console.log(timmy.success(`${colors.bright}Codex${colors.reset} completed implementation for ${colors.bright}task-${taskId}${colors.reset}`));

      // Cleanup files
      fs.unlinkSync(promptFile);
      fs.unlinkSync(inputFile);

      // Check if Codex made any changes and auto-commit/push them
      console.log(timmy.info('Checking for uncommitted changes from Codex implementation...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(timmy.info('Codex made changes. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${repoPath}" && git add . && git commit -m "feat: ${taskTitle} (#${taskId})" && git push -u origin task-${taskId}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(timmy.success('Codex implementation committed and pushed'));
        } else {
          console.log(timmy.info('No changes to commit from Codex implementation'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(timmy.warning(`Failed to auto-commit Codex changes: ${err.message}`));
        // Don't fail the whole implementation if git operations fail
      }

      await clickup.addComment(
        taskId,
        `✅ **Codex Implementation Complete**\n\n` +
        `Codex has finished implementing the feature.\n\n` +
        `**Branch:** \`task-${taskId}\`\n` +
        `**Status:** Complete\n\n` +
        `Next: Pull Request should be created`
      );

      return {
        success: true,
        branch: `task-${taskId}`
      };

    } catch (codexError) {
      const err = codexError as Error;
      console.log(timmy.error(`${colors.bright}Codex${colors.reset} execution failed: ${err.message}`));

      // Cleanup files
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }
      if (fs.existsSync(inputFile)) {
        fs.unlinkSync(inputFile);
      }

      throw codexError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Codex deployment failed: ${err.message}`));
    console.log(timmy.info('Task queued for manual processing'));

    await storage.queue.add(task);
    return { success: false, error: err.message };
  }
}

async function reviewClaudeChanges(task: ClickUpTask, options: ReviewOptions = {}): Promise<ReviewResult> {
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

  console.log(timmy.ai(`${colors.bright}Codex${colors.reset} reviewing Claude's changes for ${colors.bright}${taskId}${colors.reset}`));
  ensureCodexSettings(repoPath);

  // Load context for review (uses RAG if available, falls back to Smart Loader)
  console.log(timmy.info('Loading relevant review guidelines...'));
  const smartContext = await loadContextForModel({
    model: 'codex',
    taskDescription: `Code review for: ${taskTitle}\n\nReviewing implementation changes`,
    topK: 5,
    minRelevance: 0.7
  });

  const prompt = `${smartContext ? smartContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}You are a senior code reviewer. Your job is to review the changes made by Claude and add constructive TODO comments for improvements.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Branch:** ${branch}

**Repository Information:**
- Path: ${repoPath}
- Owner: ${repoOwner}
- Repo: ${repoName}

**Your Review Process:**

1. **Checkout the branch:**
   cd ${repoPath}
   git checkout ${branch}
   git pull origin ${branch}

2. **Review all changes:**
   git diff main...${branch}

   Look at:
   - Code quality and best practices
   - Potential bugs or edge cases
   - Performance improvements
   - Security concerns
   - Missing error handling
   - Code readability and maintainability
   - Missing tests

3. **Add TODO and FIXME comments DIRECTLY in the code files:**
   - Open each modified file
   - Add clear, actionable comments where improvements are needed
   - Use TODO for enhancements/nice-to-haves
   - Use FIXME for bugs/critical issues that must be addressed
   - Format: \`// TODO: [Enhancement suggestion]\` or \`// FIXME: [Critical issue]\`
   - Be specific and constructive
   - Focus on:
     * FIXME: Bugs or critical issues
     * FIXME: Missing error handling
     * FIXME: Security vulnerabilities
     * TODO: Edge cases not handled
     * TODO: Performance optimizations
     * TODO: Code clarity improvements
     * TODO: Missing validation
     * TODO: Additional tests needed

4. **Commit your TODO and FIXME comments:**
   git add .
   git commit -m "review: Add TODO/FIXME comments from Codex review (#${taskId})"
   git push origin ${branch}

**Important Guidelines:**
- Add TODO and FIXME comments INLINE in the code files (not in separate review files)
- Be constructive and specific
- Each comment should be actionable
- Use FIXME for critical issues, TODO for enhancements
- Focus on improvements, not just criticism
- Don't rewrite the code, just add comments
- Priority: FIXME > TODO

**Example comments:**
\`\`\`javascript
// FIXME: This will crash when user is null - add null check
// FIXME: SQL injection vulnerability - use parameterized query
// FIXME: Race condition possible - add mutex lock
// TODO: Add validation for empty email
// TODO: Handle error case when API fails
// TODO: Add unit test for edge case with negative numbers
// TODO: Consider caching this expensive operation
// TODO: Extract this logic into a separate function for reusability
\`\`\`

Begin your review now and add TODO/FIXME comments to the code!`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-codex-review-prompt.txt`);
    const logsDir = path.join(__dirname, '..', 'logs');
    const logFile = path.join(logsDir, `${taskId}-codex.log`);

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(promptFile, prompt);

    console.log(timmy.info(`${colors.bright}Codex${colors.reset} starting code review...`));
    console.log(timmy.info(`Log file: ${colors.dim}${logFile}${colors.reset}`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Create input file with 'y' confirmation and prompt
    const inputFile = path.join(__dirname, '..', `task-${taskId}-codex-input.txt`);
    const promptContent = fs.readFileSync(promptFile, 'utf8');
    fs.writeFileSync(inputFile, `y\n${promptContent}`);

    // Execute Codex SYNCHRONOUSLY - wait for it to complete
    // Use codex exec with full-auto for non-interactive execution
    const codexCommand = `cd "${repoPath}" && codex exec --full-auto --sandbox danger-full-access < "${inputFile}"`;

    try {
      const { stdout, stderr } = await execAsync(codexCommand, {
        env: cleanEnv,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 1800000 // 30 minute timeout
      });

      // Save Codex output to log file for debugging
      const logOutput = `=== CODEX REVIEW OUTPUT ===\n\n` +
        `STDOUT:\n${stdout || '(empty)'}\n\n` +
        `STDERR:\n${stderr || '(empty)'}\n`;
      fs.writeFileSync(logFile, logOutput);

      // Log summary to logger
      if (stdout) {
        logger.info('Codex stdout', { output: stdout.substring(0, 1000) }); // First 1000 chars
      }
      if (stderr) {
        logger.warn('Codex stderr', { output: stderr.substring(0, 1000) });
      }

      console.log(timmy.success(`${colors.bright}Codex${colors.reset} completed code review for ${colors.bright}${branch}${colors.reset}`));
      console.log(timmy.info(`Review output saved to: ${colors.dim}${logFile}${colors.reset}`));

      // Cleanup files
      fs.unlinkSync(promptFile);
      fs.unlinkSync(inputFile);

      // Check if Codex made any changes and auto-commit/push them
      console.log(timmy.info('Checking for uncommitted changes from Codex review...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(timmy.info('Codex made changes. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${repoPath}" && git add . && git commit -m "review: Add TODO/FIXME comments from Codex review (#${taskId})" && git push origin ${branch}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(timmy.success('Codex review changes committed and pushed'));
        } else {
          console.log(timmy.info('No changes to commit from Codex review'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(timmy.warning(`Failed to auto-commit Codex changes: ${err.message}`));
        // Don't fail the whole review if git operations fail
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
        `✅ **Codex Code Review Complete**\n\n` +
        `Codex has finished reviewing Claude's implementation and added TODO/FIXME comments.\n\n` +
        `**Branch:** \`${branch}\`\n` +
        `**Status:** ${commitStatus}\n\n` +
        `Next: Claude will address the TODO comments`
      );

      return {
        success: true,
        branch
      };

    } catch (codexError) {
      const err = codexError as Error;
      console.log(timmy.error(`${colors.bright}Codex${colors.reset} review execution failed: ${err.message}`));

      // Cleanup files
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }
      if (fs.existsSync(inputFile)) {
        fs.unlinkSync(inputFile);
      }

      throw codexError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Codex review failed: ${err.message}`));
    return { success: false, error: err.message };
  }
}

export {
  ensureCodexSettings,
  launchCodex,
  reviewClaudeChanges,
  execWithPTY,
  // Types
  ClickUpTask,
  ExecWithPTYOptions,
  ExecResult,
  LaunchOptions,
  ReviewOptions,
  LaunchResult,
  ReviewResult,
  Settings,
  ErrorWithCode
};
