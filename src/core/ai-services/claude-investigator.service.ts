/**
 * Claude Investigator Service
 * Uses Claude Code to investigate issues in the codebase
 * Separate from claude.service.ts (which handles implementation)
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import config, { RepositoryConfig } from '../../shared/config';
import { timmy, colors } from '../../shared/ui';
import { withRetry, RetryOptions } from '../../shared/utils/retry.util';
import type { ClickUpTask } from '../../types/clickup';
import type { ExecResult } from '../../types/common';

const execAsync = promisify(exec);

export interface InvestigationResult {
  success: boolean;
  detailedDescription: string;
  filesIdentified: string[];
  technicalContext: string;
  investigationFile?: string;
  error?: string;
}

interface InvestigateOptions {
  repoConfig?: RepositoryConfig;
}

/**
 * Investigate issue in codebase using Claude
 * Claude will search for relevant files and provide technical context
 */
async function investigateIssue(
  task: ClickUpTask,
  options: InvestigateOptions = {}
): Promise<InvestigationResult> {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || '';
  const { repoConfig } = options;

  // Use provided repoConfig or fall back to legacy config
  const repoPath = repoConfig?.path || config.github.repoPath;
  const repoOwner = repoConfig?.owner || config.github.owner;
  const repoName = repoConfig?.repo || config.github.repo;

  if (!repoPath) {
    throw new Error('Repository path not configured');
  }

  console.log(
    timmy.processing(
      `${colors.bright}Claude Investigator${colors.reset} searching codebase for ${colors.bright}${taskId}${colors.reset}...`
    )
  );

  // Create investigation directory
  const investigationDir = path.join(config.files.featuresDir, taskId);
  if (!fs.existsSync(investigationDir)) {
    fs.mkdirSync(investigationDir, { recursive: true });
  }

  // Create investigation prompt file
  const investigationPrompt = `You are investigating a bug/issue reported by a user via Discord.

**Task ID:** ${taskId}
**Issue Title:** ${taskTitle}
**User's Description:**
${taskDescription}

**Repository:** ${repoPath}
**Owner:** ${repoOwner}
**Repo:** ${repoName}

---

## Your Investigation Task

Your job is to search the codebase and identify where this issue might be located. Use your tools (Grep, Glob, Read) to investigate.

**DO NOT IMPLEMENT ANY CODE.** This is investigation only.

## Steps to Follow:

1. **Understand the Issue**
   - What component/feature is affected?
   - What error or behavior is being reported?

2. **Search for Relevant Code**
   - Use Glob to find relevant files (e.g., \`**/*login*.tsx\` if it's about login)
   - Use Grep to search for keywords (function names, error messages, etc.)
   - Use Read to examine suspicious files

3. **Identify Key Locations**
   - Which files likely contain the issue?
   - Specific line numbers if you can find them
   - Related files (APIs, utilities, tests)

4. **Gather Technical Context**
   - What framework/libraries are used?
   - What patterns does the code follow?
   - Any relevant dependencies?

## Output Format

Provide your investigation report in this EXACT format:

\`\`\`markdown
## Investigation Report: ${taskTitle}

### Original User Request
${taskDescription}

---

### Codebase Investigation

**Primary Files to Investigate:**
- \`path/to/file1.tsx\`:45-67 - Login button component with onClick handler
- \`path/to/file2.ts\`:89 - API endpoint for authentication
- \`path/to/file3.ts\`:23 - Validation logic that might be failing

**Related Code Locations:**
- Error handling: \`src/hooks/useAuth.ts\`:112
- State management: \`src/store/authSlice.ts\`:34
- Type definitions: \`src/types/auth.ts\`:12

**Framework & Technical Context:**
- Framework: React with TypeScript
- State: Redux Toolkit
- Auth: Custom hook \`useAuth\`
- API: REST endpoint POST /api/auth/login

**Relevant Code Patterns Found:**
- Authentication follows OAuth2 flow
- Error handling uses custom ErrorBoundary
- Validation uses Zod schemas

### Recommended Next Steps for Implementation
1. Review the onClick handler in LoginButton component
2. Check API error response format
3. Verify email validation in validators.ts
4. Test with various email formats

### Potential Root Causes
- Validation regex might be too strict
- API endpoint might have changed
- State not updating after login attempt
- Missing error boundary

---

**Investigation Status:** Complete
**Files Identified:** 6
**Ready for Implementation:** Yes
\`\`\`

**IMPORTANT:**
- Be SPECIFIC with file paths (use actual paths from the repo)
- Include line numbers when you find them
- If you can't find something, say "Could not locate [X]" instead of guessing
- Focus on FACTS from the codebase, not assumptions`;

  try {
    // Save prompt to file
    const promptFile = path.join(investigationDir, 'investigation-prompt.txt');
    fs.writeFileSync(promptFile, investigationPrompt);

    console.log(timmy.info('Running Claude investigation...'));

    // Call Claude Code CLI (same pattern as claude.service.ts)
    const result = await withRetry(
      async (): Promise<string> => {
        const { stdout }: ExecResult = await execAsync(
          `cd "${repoPath}" && (echo "y"; sleep 2; cat "${promptFile}") | ${config.system.claudeCliPath} --dangerously-skip-permissions`,
          {
            timeout: 180000, // 3 minute timeout
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            shell: '/bin/bash',
          }
        );
        return stdout;
      },
      {
        maxAttempts: 2,
        timeoutMs: 180000,
        onRetry: (attempt: number): Promise<void> => {
          console.log(
            timmy.info(
              `${colors.bright}Claude Investigator${colors.reset} retry attempt ${attempt}/2...`
            )
          );
          return Promise.resolve();
        },
      } as RetryOptions
    );

    // Save investigation report
    const investigationFile = path.join(investigationDir, 'investigation-report.md');
    fs.writeFileSync(investigationFile, result.trim());

    console.log(timmy.success(`Investigation complete: ${investigationFile}`));

    // Extract file paths from the report
    const fileMatches = result.match(/`([^`]+\.(ts|tsx|js|jsx|py|java|go|rs))`/g) || [];
    const filesIdentified = fileMatches.map(match => match.replace(/`/g, ''));

    // Create enhanced task description with investigation findings
    const detailedDescription = formatDetailedDescription(task, result);

    return {
      success: true,
      detailedDescription,
      filesIdentified: [...new Set(filesIdentified)], // Remove duplicates
      technicalContext: result.trim(),
      investigationFile,
    };
  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Claude investigation failed: ${err.message}`));

    // Fallback: return original description
    const fallbackDescription = `**Reported via Discord**

${taskDescription}

---

**Investigation Status:** Failed
**Error:** ${err.message}

The investigation could not be completed automatically. Manual review required.`;

    return {
      success: false,
      detailedDescription: fallbackDescription,
      filesIdentified: [],
      technicalContext: '',
      error: err.message,
    };
  }
}

/**
 * Format detailed task description with investigation findings
 */
function formatDetailedDescription(task: ClickUpTask, investigationReport: string): string {
  const originalDescription = task.description || task.text_content || '';

  return `${originalDescription}

---

## 🔍 Automated Investigation Report

${investigationReport}

---

**Investigation completed by:** Claude Investigator
**Ready for implementation:** Yes
`;
}

export { investigateIssue, InvestigationResult, InvestigateOptions };
