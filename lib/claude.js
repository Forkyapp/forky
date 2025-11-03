const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const config = require('./config');
const { jarvis, colors } = require('./ui');
const clickup = require('./clickup');
const storage = require('./storage');

const execAsync = promisify(exec);

function ensureClaudeSettings() {
  const claudeDir = path.join(config.github.repoPath, '.claude');
  const settingsFile = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  const settings = {
    "permissions": {
      "allow": [
        "Bash(*)",
        "Read(*)",
        "Write(*)",
        "Edit(*)",
        "Glob(*)",
        "Grep(*)",
        "Task(*)",
        "WebFetch(*)",
        "WebSearch(*)",
        "NotebookEdit(*)",
        "mcp__*",
        "*"
      ],
      "deny": []
    },
    "hooks": {
      "user-prompt-submit": "echo 'yes'"
    }
  };

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

async function launchClaude(task, options = {}) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';
  const { analysis, subtask, branch } = options;

  console.log(jarvis.ai(`Deploying agent for ${colors.bright}${taskId}${colors.reset}: "${taskTitle}"`));
  ensureClaudeSettings();

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
- Path: ${config.github.repoPath}
- Owner: ${config.github.owner}
- Repo: ${config.github.repo}

**Required Steps (MUST COMPLETE ALL):**

${analysis && analysis.featureDir ? `0. **Read the feature specification:**
   Read the file: ${analysis.featureDir}/feature-spec.md
   This contains detailed requirements, files to modify, and implementation guidance.

` : ''}1. **Navigate to repository:**
   cd ${config.github.repoPath}

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
🤖 Automated via Devin" --base main --head task-${taskId}

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
    const scriptFile = path.join(__dirname, '..', `task-${taskId}-launch.sh`);

    fs.writeFileSync(promptFile, prompt);

    const bashScript = `#!/bin/bash
      cd "${config.github.repoPath}"
      export PROMPT_FILE="${promptFile}"

      # Unset GITHUB_TOKEN to let gh use keyring auth
      unset GITHUB_TOKEN
      unset GH_TOKEN

      # Launch Claude Code and pipe the prompt
      (echo "y"; sleep 2; cat "$PROMPT_FILE") | claude --dangerously-skip-permissions

      # Cleanup
      rm -f "$PROMPT_FILE"
      rm -f "${scriptFile}"
`;

    fs.writeFileSync(scriptFile, bashScript);
    fs.chmodSync(scriptFile, '755');

    const appleScript = `
    tell application "Terminal"
        activate
        if (count of windows) is 0 then
            do script "${scriptFile}"
        else
            tell window 1
                do script "${scriptFile}"
            end tell
        end if
    end tell
`;

    await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`);

    console.log(jarvis.success(`Agent active on ${colors.bright}task-${taskId}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `🤖 **Agent Deployed**\n\n` +
      `Autonomous agent is now executing this task.\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Working autonomously\n\n` +
      `You'll be notified when the Pull Request is ready.`
    );

    storage.tracking.start(task);
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true };

  } catch (error) {
    console.log(jarvis.error(`Deployment failed: ${error.message}`));
    console.log(jarvis.info('Task queued for manual processing'));

    await storage.queue.add(task);

    return { success: false, error: error.message };
  }
}

async function fixTodoComments(task, options = {}) {
  const taskId = task.id;
  const taskTitle = task.name;
  const branch = `task-${taskId}`;

  console.log(jarvis.ai(`Claude addressing TODO/FIXME comments for ${colors.bright}${taskId}${colors.reset}`));
  ensureClaudeSettings();

  const prompt = `You need to address the TODO and FIXME comments that Codex added during code review.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Branch:** ${branch}

**Repository Information:**
- Path: ${config.github.repoPath}
- Owner: ${config.github.owner}
- Repo: ${config.github.repo}

**Your Task:**

1. **Checkout the branch:**
   cd ${config.github.repoPath}
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
    const scriptFile = path.join(__dirname, '..', `task-${taskId}-fix-todos.sh`);

    fs.writeFileSync(promptFile, prompt);

    const bashScript = `#!/bin/bash
      cd "${config.github.repoPath}"
      export PROMPT_FILE="${promptFile}"

      # Unset GITHUB_TOKEN to let gh use keyring auth
      unset GITHUB_TOKEN
      unset GH_TOKEN

      # Launch Claude to fix TODOs
      (echo "y"; sleep 2; cat "$PROMPT_FILE") | claude --dangerously-skip-permissions

      # Cleanup
      rm -f "$PROMPT_FILE"
      rm -f "${scriptFile}"
`;

    fs.writeFileSync(scriptFile, bashScript);
    fs.chmodSync(scriptFile, '755');

    const appleScript = `
    tell application "Terminal"
        activate
        if (count of windows) is 0 then
            do script "${scriptFile}"
        else
            tell window 1
                do script "${scriptFile}"
            end tell
        end if
    end tell
`;

    await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`);

    console.log(jarvis.success(`Claude fixing TODOs for ${colors.bright}${branch}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `🔧 **Claude Fixing TODO/FIXME Comments**\n\n` +
      `Claude is now addressing all the TODO and FIXME comments from Codex's review.\n\n` +
      `**Branch:** \`${branch}\`\n` +
      `**Priority:** FIXME (critical) first, then TODO (enhancements)\n` +
      `**Final Step:** PR will be updated with all improvements`
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true, branch };

  } catch (error) {
    console.log(jarvis.error(`TODO fix failed: ${error.message}`));

    return { success: false, error: error.message };
  }
}

module.exports = {
  ensureClaudeSettings,
  launchClaude,
  fixTodoComments,
};
