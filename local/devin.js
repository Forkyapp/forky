require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ============================================
// CONFIGURATION
// ============================================

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const CLICKUP_BOT_USER_ID = parseInt(process.env.CLICKUP_BOT_USER_ID || '0');
const CLICKUP_WORKSPACE_ID = process.env.CLICKUP_WORKSPACE_ID || '90181842045';
const GITHUB_REPO_PATH = process.env.GITHUB_REPO_PATH;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000'); // 15 seconds default
const CODEX_CLI_PATH = process.env.CODEX_CLI_PATH || 'codex';

// Processed tasks cache (prevents duplicates)
const CACHE_FILE = path.join(__dirname, 'processed-tasks.json');
const processedTasksData = loadProcessedTasks();
const processedTaskIds = new Set(processedTasksData.map(t => t.id));

// ============================================
// CACHE MANAGEMENT
// ============================================

function loadProcessedTasks() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      // Support both old format (array of IDs) and new format (array of objects)
      if (data.length > 0 && typeof data[0] === 'string') {
        // Old format - convert to new
        return data.map(id => ({ id, title: 'Unknown', description: '', detectedAt: new Date().toISOString() }));
      }
      return data;
    }
  } catch (error) {
    console.error('Error loading cache:', error.message);
  }
  return [];
}

function saveProcessedTasks() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(processedTasksData, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error.message);
  }
}

function addToProcessed(task) {
  if (!processedTaskIds.has(task.id)) {
    processedTasksData.push({
      id: task.id,
      title: task.name,
      description: task.description || task.text_content || '',
      detectedAt: new Date().toISOString()
    });
    processedTaskIds.add(task.id);
    saveProcessedTasks();
  }
}

// ============================================
// CLICKUP API
// ============================================

async function getAssignedTasks() {
  try {
    const response = await axios.get(
      `https://api.clickup.com/api/v2/team/${CLICKUP_WORKSPACE_ID}/task`,
      {
        headers: {
          'Authorization': CLICKUP_API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          assignees: [CLICKUP_BOT_USER_ID],
          subtasks: false,
          order_by: 'updated',
          reverse: true
        }
      }
    );

    const allTasks = response.data.tasks || [];
    const filteredTasks = allTasks.filter(task => task.status?.status === 'bot in progress');

    console.log(`[${new Date().toISOString()}] Found ${allTasks.length} total tasks, ${filteredTasks.length} with status 'bot in progress'`);
    return filteredTasks;
  } catch (error) {
    console.error('Error fetching tasks:', error.message);
    return [];
  }
}

async function updateTaskStatus(taskId, statusId) {
  try {
    await axios.put(
      `https://api.clickup.com/api/v2/task/${taskId}`,
      { status: statusId },
      {
        headers: {
          'Authorization': CLICKUP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Updated task ${taskId} status`);
  } catch (error) {
    console.error(`❌ Error updating task status:`, error.message);
  }
}

async function addClickUpComment(taskId, commentText) {
  try {
    await axios.post(
      `https://api.clickup.com/api/v2/task/${taskId}/comment`,
      { comment_text: commentText },
      {
        headers: {
          'Authorization': CLICKUP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Added comment to task ${taskId}`);
  } catch (error) {
    console.error(`❌ Error adding comment:`, error.message);
  }
}

// ============================================
// TASK QUEUE MANAGEMENT
// ============================================

const QUEUE_FILE = path.join(__dirname, 'task-queue.json');

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading queue:', error.message);
  }
  return { pending: [], completed: [] };
}

function saveQueue(queue) {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (error) {
    console.error('Error saving queue:', error.message);
  }
}

async function queueTask(task) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📥 QUEUING TASK: ${taskTitle} (${taskId})`);
  console.log(`${'='.repeat(70)}\n`);

  // Load current queue
  const queue = loadQueue();

  // Check if already queued
  if (queue.pending.find(t => t.id === taskId)) {
    console.log(`⚠️  Task ${taskId} already in queue\n`);
    return { alreadyQueued: true };
  }

  // Add to queue
  queue.pending.push({
    id: taskId,
    title: taskTitle,
    description: taskDescription,
    url: task.url,
    queuedAt: new Date().toISOString(),
    repoPath: GITHUB_REPO_PATH,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: `task-${taskId}`,
    commitMessage: `feat: ${taskTitle} (#${taskId})`,
    prTitle: `[ClickUp #${taskId}] ${taskTitle}`,
    prBody: `## ClickUp Task\n\n**Task:** ${taskTitle}\n**ID:** ${taskId}\n**URL:** ${task.url}\n\n## Description\n\n${taskDescription}\n\n---\n\n🤖 Queued by Devin for Codex processing`
  });

  // Save queue
  saveQueue(queue);

  console.log(`✅ Task queued successfully`);
  console.log(`📊 Queue status: ${queue.pending.length} pending, ${queue.completed.length} completed\n`);

  return { success: true };
}

// ============================================
// PR TRACKING SYSTEM
// ============================================

const PR_TRACKING_FILE = path.join(__dirname, 'pr-tracking.json');
const PR_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const PR_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout

function loadPRTracking() {
  try {
    if (fs.existsSync(PR_TRACKING_FILE)) {
      return JSON.parse(fs.readFileSync(PR_TRACKING_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading PR tracking:', error.message);
  }
  return [];
}

function savePRTracking(tracking) {
  try {
    fs.writeFileSync(PR_TRACKING_FILE, JSON.stringify(tracking, null, 2));
  } catch (error) {
    console.error('Error saving PR tracking:', error.message);
  }
}

let prTracking = loadPRTracking();

function startPRTracking(task) {
  const tracking = {
    taskId: task.id,
    taskName: task.name,
    branch: `task-${task.id}`,
    startedAt: new Date().toISOString(),
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO
  };

  prTracking.push(tracking);
  savePRTracking(prTracking);

  console.log(`📊 Started tracking PR for task ${task.id}`);
}

async function checkForPR(tracking) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${tracking.owner}/${tracking.repo}/pulls`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          head: `${tracking.owner}:${tracking.branch}`,
          state: 'all'
        }
      }
    );

    if (response.data && response.data.length > 0) {
      const pr = response.data[0];
      return {
        found: true,
        url: pr.html_url,
        number: pr.number,
        state: pr.state
      };
    }
  } catch (error) {
    console.error(`Error checking PR for ${tracking.taskId}:`, error.message);
  }

  return { found: false };
}

async function pollForPRs() {
  const now = new Date();

  for (let i = prTracking.length - 1; i >= 0; i--) {
    const tracking = prTracking[i];
    const startedAt = new Date(tracking.startedAt);
    const elapsed = now - startedAt;

    // Check if timed out
    if (elapsed > PR_TIMEOUT_MS) {
      console.log(`⏰ PR tracking timeout for task ${tracking.taskId} (30 minutes)`);

      await addClickUpComment(
        tracking.taskId,
        `⚠️ **Timeout Warning**\n\n` +
        `No Pull Request detected after 30 minutes.\n\n` +
        `Please check the Terminal tab to see if Codex encountered any issues.`
      );

      // Remove from tracking
      prTracking.splice(i, 1);
      savePRTracking(prTracking);
      continue;
    }

    // Check for PR
    const result = await checkForPR(tracking);

    if (result.found) {
      console.log(`\n✅ PR DETECTED for task ${tracking.taskId}!`);
      console.log(`   PR URL: ${result.url}`);

      // Add comment with PR URL
      await addClickUpComment(
        tracking.taskId,
        `✅ **Pull Request Created**\n\n` +
        `**PR #${result.number}:** ${result.url}\n\n` +
        `The implementation is complete and ready for review!`
      );

      // Update status to "can be checked"
      await updateTaskStatus(tracking.taskId, 'can be checked');

      // Remove from tracking
      prTracking.splice(i, 1);
      savePRTracking(prTracking);
    }
  }
}

// ============================================
// CODEX AUTOMATION (via osascript)
// ============================================

function ensureClaudeSettings() {
  const claudeDir = path.join(GITHUB_REPO_PATH, '.claude');
  const settingsFile = path.join(claudeDir, 'settings.json');

  // Create .claude directory if it doesn't exist
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
    console.log(`   Created .claude directory in repository`);
  }

  // Always recreate settings.json with latest permissions
  console.log(`   Recreating .claude/settings.json with FULL AUTONOMOUS permissions`);
  const settings = {
      "permissions": {
        "allow": [
          "*"
        ],
        "deny": []
      }
  };

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  console.log(`   Updated .claude/settings.json with latest permissions`);
}

async function launchCodex(task) {
  const taskId = task.id;
  const taskTitle = task.name;
  const taskDescription = task.description || task.text_content || 'No description provided';

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 LAUNCHING CODEX IN NEW TERMINAL TAB`);
  console.log(`   Task: ${taskTitle} (${taskId})`);
  console.log(`${'='.repeat(70)}\n`);

  // Ensure .claude/settings.json exists to bypass security prompts
  console.log(`1️⃣  Ensuring .claude/settings.json exists...`);
  ensureClaudeSettings();

  // Create comprehensive prompt
  const prompt = `I need you to implement a ClickUp task and create a GitHub Pull Request.

**ClickUp Task ID:** ${taskId}
**Title:** ${taskTitle}
**Description:**
${taskDescription}

**Repository Information:**
- Path: ${GITHUB_REPO_PATH}
- Owner: ${GITHUB_OWNER}
- Repo: ${GITHUB_REPO}

**Required Steps (MUST COMPLETE ALL):**

1. **Navigate to repository:**
   cd ${GITHUB_REPO_PATH}

2. **Check git status:**
   git status
   (Ensure working tree is clean)

3. **Create new branch:**
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
- Do not use git rebase
- Do not use git reset
- Do not use git revert
- Do not use git cherry-pick
- Do not use git merge
- Do not use git rm or git rmdir
- Do not use git commit --amend
- Do not use git rebase
- Do not use git reset
- Do not use git revert
- Do not use git cherry-pick
- Do not use git merge
- Install new packages without asking
- MUST complete ALL steps including PR creation

**ClickUp Task URL:** ${task.url || `https://app.clickup.com/t/${taskId}`}

Begin implementation now and make sure to create the PR when done!`;

  try {
    // Step 2: Save prompt to temp file and copy to clipboard
    console.log(`2️⃣  Copying task details to clipboard...`);
    const tempFile = path.join(__dirname, `temp-prompt-${taskId}.txt`);
    fs.writeFileSync(tempFile, prompt);
    await execAsync(`cat '${tempFile}' | pbcopy`);
    fs.unlinkSync(tempFile); // Clean up temp file

    // Step 3: Activate Terminal
    console.log(`3️⃣  Activating Terminal...`);
    await execAsync(`osascript -e 'tell application "Terminal" to activate'`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Press Cmd+T to open new tab
    console.log(`4️⃣  Opening new tab (Cmd+T)...`);
    const openTab = `
tell application "System Events"
    tell process "Terminal"
        keystroke "t" using command down
    end tell
end tell
`;
    await execAsync(`osascript -e '${openTab.replace(/'/g, "'\"'\"'")}'`);

    // Step 5: Wait 3 seconds for tab to open
    console.log(`5️⃣  Waiting 3 seconds for new tab...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 6: Type "cd to repo && codex" and press Enter
    console.log(`6️⃣  Running 'cd && codex' command...`);
    const cdCommand = `cd "${GITHUB_REPO_PATH}" && codex`;
    const runClaude = `
tell application "System Events"
    tell process "Terminal"
        keystroke "${cdCommand.replace(/"/g, '\\"')}"
        keystroke return
    end tell
end tell
`;
    await execAsync(`osascript -e '${runClaude.replace(/'/g, "'\"'\"'")}'`);

    // Step 7: Wait 3 seconds for security prompt
    console.log(`7️⃣  Waiting 3 seconds for security prompt...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 8: Press Enter to confirm security prompt
    console.log(`8️⃣  Auto-confirming security prompt (Enter)...`);
    const pressEnter = `
tell application "System Events"
    keystroke return
end tell
`;
    await execAsync(`osascript -e '${pressEnter.replace(/'/g, "'\"'\"'")}'`);

    // Step 9: Wait 2 seconds for Codex to start
    console.log(`9️⃣  Waiting 2 seconds for Codex to start...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 10: Press Shift+Tab to enable auto-edit mode
    console.log(`🔟  Enabling auto-edit mode (Shift+Tab)...`);
    const enableEditMode = `
tell application "System Events"
    keystroke tab using shift down
end tell
`;
    await execAsync(`osascript -e '${enableEditMode.replace(/'/g, "'\"'\"'")}'`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 11: Paste the prompt (Cmd+V)
    console.log(`1️⃣1️⃣  Pasting task details (Cmd+V)...`);
    const pastePrompt = `
tell application "System Events"
    tell process "Terminal"
        keystroke "v" using command down
    end tell
end tell
`;
    await execAsync(`osascript -e '${pastePrompt.replace(/'/g, "'\"'\"'")}'`);

    // Step 12: Wait a moment then press Enter to send
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`1️⃣2️⃣  Sending prompt (Enter)...`);
    await execAsync(`osascript -e 'tell application "System Events" to keystroke return'`);

    console.log(`✅ Codex launched with task details!`);
    console.log(`📋 Task ID: ${taskId}`);
    console.log(`📌 Task Title: ${taskTitle}`);
    console.log(`👀 Check the new Terminal tab - I should be working on it!\n`);

    // Add comment to ClickUp that bot started working
    await addClickUpComment(
      taskId,
      `🤖 **Bot Started Working**\n\n` +
      `Codex has been launched and is now implementing this task.\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Repository:** ${GITHUB_REPO_PATH}\n\n` +
      `I will update this task when the Pull Request is created.`
    );

    // Start tracking this task for PR detection
    startPRTracking(task);

    // Add extra delay between tasks to prevent overlap
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true };

  } catch (error) {
    console.error(`❌ Failed to launch Codex:`, error.message);
    console.log(`\n📋 FALLBACK: Task added to queue instead`);

    // Fallback to queue
    await queueTask(task);

    return { success: false, error: error.message };
  }
}

// ============================================
// MAIN POLLING LOOP
// ============================================

async function pollAndProcess() {
  try {
    const tasks = await getAssignedTasks();

    for (const task of tasks) {
      // Skip if already processed
      if (processedTaskIds.has(task.id)) {
        continue;
      }

      console.log(`\n🆕 NEW TASK DETECTED: ${task.id} - ${task.name}`);

      // Mark as processed IMMEDIATELY to prevent duplicate detection
      addToProcessed(task);

      try {
        // Launch Codex in new Terminal window
        const result = await launchCodex(task);

        if (result.success) {
          console.log(`✨ Task ${task.id} handed off to Codex\n`);
        } else {
          console.log(`⚠️  Task ${task.id} added to manual queue\n`);
        }

      } catch (error) {
        console.error(`❌ Error processing task ${task.id}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Error in polling loop:', error.message);
  }
}

// ============================================
// STARTUP
// ============================================

console.log('\n' + '='.repeat(70));
console.log('🤖 DEVIN - ClickUp Task Queue Manager');
console.log('='.repeat(70));
console.log(`\n📍 Workspace: ${CLICKUP_WORKSPACE_ID}`);
console.log(`👤 Bot User ID: ${CLICKUP_BOT_USER_ID}`);
console.log(`📁 GitHub Repo: ${GITHUB_REPO_PATH}`);
console.log(`⏱️  Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
console.log(`💾 Already Detected: ${processedTasksData.length} tasks`);

// Load queue status
const queue = loadQueue();
console.log(`📊 Current Queue: ${queue.pending.length} pending, ${queue.completed.length} completed\n`);

// Validate configuration
if (!GITHUB_REPO_PATH || !fs.existsSync(GITHUB_REPO_PATH)) {
  console.error('❌ ERROR: GITHUB_REPO_PATH not set or does not exist');
  console.error('Please set GITHUB_REPO_PATH in .env file\n');
  process.exit(1);
}

console.log('✅ Configuration validated');

// Ensure .claude/settings.json is created/updated with latest permissions
console.log('📝 Setting up Codex permissions...');
ensureClaudeSettings();

console.log('🚀 Starting polling...');
console.log('💡 New tasks will automatically launch Codex in a new Terminal');
console.log(`📊 Tracking ${prTracking.length} tasks for PR completion\n`);

// Initial poll
pollAndProcess();

// Set up intervals
setInterval(pollAndProcess, POLL_INTERVAL_MS);
setInterval(pollForPRs, PR_CHECK_INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping Devin...');
  saveProcessedTasks();
  savePRTracking(prTracking);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Stopping Devin...');
  saveProcessedTasks();
  savePRTracking(prTracking);
  process.exit(0);
});
