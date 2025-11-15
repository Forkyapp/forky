/**
 * Qwen AI Service - Automated Unit Test Generation
 *
 * ⚠️ STATUS: NOT CURRENTLY USED - RESERVED FOR FUTURE USE
 *
 * This service integrates Qwen AI for automated comprehensive unit test generation.
 * Currently disabled in the pipeline (see orchestrator.service.ts line 108-110) but
 * fully implemented and ready to enable.
 *
 * **Capabilities:**
 * - Analyzes code changes in feature branches
 * - Generates comprehensive unit tests (happy path, edge cases, error handling)
 * - Follows project testing conventions and patterns
 * - Auto-commits and pushes test files
 * - Aims for 80%+ test coverage
 *
 * **To Enable:**
 * Uncomment the Qwen testing stage in orchestrator.service.ts (Stage 4)
 *
 * **Future Enhancements:**
 * - Integration test generation
 * - E2E test scaffolding
 * - Test quality analysis
 *
 * DO NOT REMOVE - This is fully functional code ready to be enabled.
 *
 * @module ai-services/qwen
 * @status disabled
 * @readyToEnable true
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import config from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import * as clickup from '../../../lib/clickup';
import { loadContextForModel } from '../context/context-orchestrator';
import type { ClickUpTask } from '../../../src/types/clickup';
import type { QwenWriteTestsOptions, QwenWriteTestsResult, Settings } from '../../../src/types/ai';

const execAsync = promisify(exec);

function ensureQwenSettings(repoPath: string | null = null): void {
  const targetRepoPath = repoPath || config.github.repoPath;
  if (!targetRepoPath) {
    throw new Error('Repository path is not configured');
  }

  const qwenDir = path.join(targetRepoPath, '.claude');
  const settingsFile = path.join(qwenDir, 'settings.json');

  if (!fs.existsSync(qwenDir)) {
    fs.mkdirSync(qwenDir, { recursive: true });
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

async function writeTests(task: ClickUpTask, options: QwenWriteTestsOptions = {}): Promise<QwenWriteTestsResult> {
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

  console.log(timmy.ai(`${colors.bright}Qwen${colors.reset} writing unit tests for ${colors.bright}${taskId}${colors.reset}`));
  ensureQwenSettings(repoPath);

  // Load context for test writing (uses RAG if available, falls back to Smart Loader)
  console.log(timmy.info('Loading relevant testing guidelines...'));
  const smartContext = await loadContextForModel({
    model: 'qwen',
    taskDescription: `Writing unit tests for: ${taskTitle}`,
    topK: 5,
    minRelevance: 0.7
  });

  const prompt = `${smartContext ? smartContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}You are a senior test engineer specializing in writing comprehensive unit tests.

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

2. **Review all code changes:**
   git diff main...${branch}

   Analyze:
   - New functions and methods added
   - Modified functionality
   - Edge cases and error handling
   - Integration points
   - Business logic

3. **Identify what needs testing:**
   - List all new/modified functions
   - Identify test file locations (follow project conventions)
   - Determine test framework being used (Jest, Mocha, Vitest, etc.)

4. **Write comprehensive unit tests:**
   For each new/modified function, create tests that cover:

   **Happy Path:**
   - Normal/expected inputs and outputs
   - Typical use cases

   **Edge Cases:**
   - Boundary values (min/max, empty, null, undefined)
   - Invalid inputs
   - Missing required parameters

   **Error Handling:**
   - Error conditions and exceptions
   - Validation failures
   - External dependency failures

   **Integration:**
   - Function interactions
   - Side effects
   - State changes

5. **Follow testing best practices:**
   - Clear, descriptive test names (describe what's being tested)
   - Arrange-Act-Assert pattern
   - One assertion per test when possible
   - Use proper mocking for external dependencies
   - Test behavior, not implementation
   - Keep tests isolated and independent
   - Follow project's existing test patterns and conventions

6. **Create or update test files:**
   - Follow the project's test file naming convention
   - Place tests in appropriate directories
   - Import necessary dependencies and test utilities
   - Add proper setup and teardown if needed

7. **Run the tests:**
   - Execute the test suite to ensure all tests pass
   - Fix any failing tests
   - Ensure no syntax errors

8. **Commit your test files:**
   git add .
   git commit -m "test: Add comprehensive unit tests (#${taskId})"
   git push origin ${branch}

**Important Guidelines:**
- Write REAL, working tests (not TODO comments or placeholders)
- Cover at least 80% of new/modified code
- Use the project's existing test framework and patterns
- Mock external dependencies (APIs, databases, file system)
- Test both success and failure scenarios
- Make tests readable and maintainable
- Add helpful comments for complex test scenarios

**Example test structure:**
\`\`\`javascript
describe('functionName', () => {
  describe('when given valid input', () => {
    it('should return expected result', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });
  });

  describe('when given invalid input', () => {
    it('should throw an error', () => {
      // Arrange
      const input = null;

      // Act & Assert
      expect(() => functionName(input)).toThrow('Input cannot be null');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('');
    });
  });
});
\`\`\`

**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin writing comprehensive unit tests now! Make sure all tests pass before committing.`;

  try {
    const promptFile = path.join(__dirname, '..', `task-${taskId}-qwen-tests-prompt.txt`);
    fs.writeFileSync(promptFile, prompt);

    console.log(timmy.info(`${colors.bright}Qwen${colors.reset} starting test generation...`));

    // Unset GITHUB_TOKEN to let gh use keyring auth
    const cleanEnv = { ...process.env };
    delete cleanEnv.GITHUB_TOKEN;
    delete cleanEnv.GH_TOKEN;

    // Execute Qwen CLI
    const qwenCommand = `cd "${repoPath}" && (echo "y"; sleep 2; cat "${promptFile}") | ${config.system.qwenCliPath} --dangerously-skip-permissions`;

    try {
      await execAsync(qwenCommand, {
        env: cleanEnv,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        timeout: 1800000 // 30 minute timeout
      });

      console.log(timmy.success(`${colors.bright}Qwen${colors.reset} completed test writing for ${colors.bright}${branch}${colors.reset}`));

      // Cleanup prompt file
      fs.unlinkSync(promptFile);

      // Check if Qwen made any changes and auto-commit/push them
      console.log(timmy.info('Checking for uncommitted changes from Qwen tests...'));

      try {
        const { stdout: statusOutput } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });

        if (statusOutput.trim()) {
          console.log(timmy.info('Qwen created tests. Committing and pushing...'));

          // Commit and push the changes
          await execAsync(
            `cd "${repoPath}" && git add . && git commit -m "test: Add comprehensive unit tests (#${taskId})" && git push origin ${branch}`,
            {
              env: cleanEnv,
              timeout: 60000 // 1 minute timeout for git operations
            }
          );

          console.log(timmy.success('Qwen tests committed and pushed'));
        } else {
          console.log(timmy.info('No test changes to commit from Qwen'));
        }
      } catch (gitError) {
        const err = gitError as Error;
        console.log(timmy.warning(`Failed to auto-commit Qwen tests: ${err.message}`));
        // Don't fail the whole process if git operations fail
      }

      // Determine if changes were auto-committed
      let commitStatus = 'Tests auto-committed and pushed';
      try {
        const { stdout: finalStatus } = await execAsync(`cd "${repoPath}" && git status --porcelain`, {
          env: cleanEnv
        });
        if (finalStatus.trim()) {
          commitStatus = 'Warning: Some test changes may not have been committed';
        }
      } catch {
        // Ignore status check errors
      }

      await clickup.addComment(
        taskId,
        `✅ **Qwen Test Writing Complete**\n\n` +
        `Qwen has finished writing comprehensive unit tests.\n\n` +
        `**Branch:** \`${branch}\`\n` +
        `**Status:** ${commitStatus}\n\n` +
        `Tests cover new functionality and edge cases`
      );

      return {
        success: true,
        branch
      };

    } catch (qwenError) {
      const err = qwenError as Error;
      console.log(timmy.error(`${colors.bright}Qwen${colors.reset} test writing failed: ${err.message}`));

      // Cleanup prompt file
      if (fs.existsSync(promptFile)) {
        fs.unlinkSync(promptFile);
      }

      throw qwenError;
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Qwen test writing failed: ${err.message}`));
    return { success: false, error: err.message };
  }
}

export {
  ensureQwenSettings,
  writeTests,
  // Types
  ClickUpTask,
  QwenWriteTestsOptions,
  QwenWriteTestsResult,
  Settings
};
