# CLAUDE.md - AI Assistant Guide for Timmy Codebase

**Last Updated:** 2025-11-15
**Project:** Timmy - ClickUp to Claude Code Integration
**Version:** 1.0.0
**Purpose:** Comprehensive guide for AI assistants working with this codebase

---

## Table of Contents

1. [Overview](#overview)
2. [Codebase Structure](#codebase-structure)
3. [Core Architecture](#core-architecture)
4. [Development Workflows](#development-workflows)
5. [Key Conventions](#key-conventions)
6. [Common Tasks](#common-tasks)
7. [Configuration Management](#configuration-management)
8. [Testing Strategy](#testing-strategy)
9. [Important Notes for AI Assistants](#important-notes-for-ai-assistants)
10. [Quick Reference](#quick-reference)

---

## Overview

### What is Timmy?

Timmy is an autonomous task automation system that bridges ClickUp task management with AI-powered code implementation. It polls ClickUp for tasks marked "bot in progress", orchestrates multiple AI services to analyze and implement features, and automatically creates GitHub pull requests.

### High-Level Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ClickUp Detection (Every 60s)                            │
│    - Polls for tasks with status "bot in progress"          │
│    - Deduplicates using cache                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Multi-AI Orchestration Pipeline                          │
│    a) Gemini Analysis  → Feature specification              │
│    b) Claude Implementation → Code changes in branch        │
│    c) Codex Review → Code quality review                    │
│    d) Claude Fixes → Fix TODOs/FIXMEs                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GitHub PR Creation                                       │
│    - Creates pull request with implementation               │
│    - Posts PR link to ClickUp task                          │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.9+ (strict mode)
- **Testing:** Jest with ts-jest
- **HTTP Client:** Axios with retry logic
- **Storage:** JSON file-based persistence
- **External Tools:** Claude Code CLI, Gemini CLI, Codex CLI
- **APIs:** ClickUp REST API v2, GitHub REST API v3

---

## Codebase Structure

### Directory Layout

```
timmy/
├── src/                          # Modern refactored codebase (PRIMARY)
│   ├── types/                   # TypeScript type definitions
│   │   ├── clickup.ts           # ClickUp domain types
│   │   ├── github.ts            # GitHub domain types
│   │   ├── ai.ts                # AI service types
│   │   ├── storage.ts           # Storage/pipeline types
│   │   ├── config.ts            # Configuration types
│   │   └── common.ts            # Shared types
│   │
│   ├── shared/                  # Shared utilities and infrastructure
│   │   ├── config/              # Configuration management
│   │   ├── errors/              # Custom error classes
│   │   ├── utils/               # Utility functions (retry, validation, logger)
│   │   ├── constants/           # Application constants
│   │   ├── ui/                  # Terminal UI formatting
│   │   └── interactive-cli.ts   # Interactive mode handler
│   │
│   ├── core/                    # Core business logic
│   │   ├── orchestrator/        # Main workflow orchestration
│   │   │   ├── stages/          # Pipeline stages (4 stages)
│   │   │   ├── utils/           # Pipeline utilities
│   │   │   └── orchestrator.service.ts
│   │   │
│   │   ├── ai-services/         # AI model integrations
│   │   │   ├── claude.service.ts
│   │   │   ├── gemini.service.ts
│   │   │   └── qwen.service.ts (disabled)
│   │   │
│   │   ├── repositories/        # Data access layer
│   │   │   ├── cache.repository.ts
│   │   │   ├── queue.repository.ts
│   │   │   ├── pipeline.repository.ts
│   │   │   ├── tracking.repository.ts
│   │   │   └── config.repository.ts
│   │   │
│   │   ├── monitoring/          # Code review and monitoring
│   │   │   ├── codex.service.ts
│   │   │   └── progress-monitor.service.ts
│   │   │
│   │   ├── workspace/           # Multi-project management
│   │   │   └── workspace.service.ts
│   │   │
│   │   └── context/             # Smart context loading
│   │       └── smart-context-loader.service.ts
│   │
│   ├── infrastructure/          # External integrations
│   │   ├── api/                 # API clients
│   │   │   ├── base.client.ts
│   │   │   ├── clickup.client.ts
│   │   │   └── github.client.ts
│   │   │
│   │   └── storage/             # Storage implementations
│   │       └── json-storage.ts
│   │
│   └── __tests__/               # Integration tests
│
├── lib/                          # Legacy code (BEING MIGRATED - DO NOT USE)
│   ├── clickup.ts               # Old ClickUp client
│   ├── github.ts                # Old GitHub client
│   └── storage/                 # Old storage modules
│
├── data/                         # Runtime state (gitignored)
│   ├── cache/                   # Processed tasks cache
│   ├── state/                   # Task queue and pipeline state
│   └── tracking/                # PR and review tracking
│
├── scripts/                      # Setup and management scripts
├── templates/                    # Configuration templates
├── .context/                     # Context for Claude Code
│
├── timmy.ts                      # Main entry point
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # User documentation
```

### Architectural Layers

```
┌──────────────────────────────────────────────────────────────┐
│ LAYER 1: Entry Point (timmy.ts)                             │
│ - Main event loop (60s polling)                              │
│ - Graceful shutdown handling                                 │
│ - Command detection from comments                            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 2: Orchestration (orchestrator.service.ts)            │
│ - Multi-stage pipeline coordination                          │
│ - State management across stages                             │
│ - Error handling and recovery                                │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 3: Services (ai-services/, monitoring/)               │
│ - Claude Code integration                                    │
│ - Gemini analysis                                            │
│ - Codex code review                                          │
│ - Smart context loading                                      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 4: Repositories (repositories/)                        │
│ - Cache management                                           │
│ - Queue management                                           │
│ - Pipeline state persistence                                 │
│ - PR tracking                                                │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 5: Infrastructure (infrastructure/)                   │
│ - ClickUp API client                                         │
│ - GitHub API client                                          │
│ - JSON file storage                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Architecture

### 1. Pipeline Stages

The orchestrator executes tasks through a sequential pipeline:

#### Stage 1: Gemini Analysis
**File:** `src/core/orchestrator/stages/analysis.stage.ts`
**Purpose:** Analyze task requirements and generate feature specification
**Input:** ClickUp task (title, description, custom fields)
**Output:** Feature specification document with architecture details
**AI Tool:** Gemini CLI

#### Stage 2: Claude Implementation
**File:** `src/core/orchestrator/stages/implementation.stage.ts`
**Purpose:** Implement the feature based on specification
**Input:** Task + Gemini analysis + smart context
**Output:** Code changes committed to feature branch
**AI Tool:** Claude Code CLI

#### Stage 3: Codex Review
**File:** `src/core/orchestrator/stages/review.stage.ts`
**Purpose:** Review code quality and suggest improvements
**Input:** Feature branch with implementation
**Output:** Review feedback and comments
**AI Tool:** Codex CLI

#### Stage 4: Claude Fixes
**File:** `src/core/orchestrator/stages/fixes.stage.ts`
**Purpose:** Fix TODO/FIXME comments and review issues
**Input:** Branch with TODOs/FIXMEs
**Output:** Clean code without outstanding TODOs
**AI Tool:** Claude Code CLI

### 2. Data Flow & State Management

#### Pipeline State Tracking
**File:** `data/state/pipeline-state.json`

```typescript
{
  "task_id_123": {
    "taskId": "task_id_123",
    "currentStage": "implementing",  // Current execution stage
    "status": "in_progress",         // Overall status
    "stages": [
      { "stage": "detected", "status": "completed", "startedAt": "...", "completedAt": "..." },
      { "stage": "analyzing", "status": "completed", "startedAt": "...", "completedAt": "..." },
      { "stage": "implementing", "status": "in_progress", "startedAt": "..." }
    ],
    "metadata": {
      "geminiAnalysis": { "file": "/path/to/spec.md", "fallback": false },
      "branches": ["feature/task-123"],
      "prNumber": 45,
      "attempts": { "codex_review": 2 },
      "errors": []
    },
    "startedAt": "2025-11-15T10:26:00Z",
    "updatedAt": "2025-11-15T10:30:00Z"
  }
}
```

#### Cache Management
**File:** `data/cache/processed-tasks.json`
**Purpose:** Prevent duplicate processing of same task
**Structure:** Map of taskId → task details

#### Queue Management
**File:** `data/state/task-queue.json`
**Purpose:** Track pending and completed tasks
**Structure:** `{ pending: [...], completed: [...] }`

### 3. Key Services

#### Orchestrator Service
**File:** `src/core/orchestrator/orchestrator.service.ts`

```typescript
// Main API
async function processTask(task: ClickUpTask): Promise<ProcessTaskResult>
async function rerunCodexReview(taskId: string): Promise<void>
async function rerunClaudeFixes(taskId: string): Promise<void>
function getTaskStatus(taskId: string): PipelineData | null
```

#### Claude Service
**File:** `src/core/ai-services/claude.service.ts`

```typescript
// Primary functions
async function launchClaude(task: ClickUpTask, options: LaunchOptions): Promise<void>
async function fixTodoComments(task: ClickUpTask, options: LaunchOptions): Promise<void>
function ensureClaudeSettings(repoPath: string): void
```

**Configuration:** Automatically creates `.claude/settings.json` with permissions:
- `Bash(*)` - Terminal commands
- `Read(*)`, `Write(*)`, `Edit(*)` - File operations
- `Glob(*)`, `Grep(*)` - Search operations
- `WebSearch(*)`, `WebFetch(*)` - Web access
- `TodoWrite(*)`, `Task(*)` - Task management

#### Workspace Service
**File:** `src/core/workspace/workspace.service.ts`

```typescript
// Multi-project management
function getActiveProject(): ProjectConfig
function switchProject(name: string): void
function listProjects(): ProjectConfig[]
```

### 4. External API Integration

#### ClickUp API Client
**File:** `lib/clickup.ts` (legacy - being migrated to `src/infrastructure/api/clickup.client.ts`)

**Key Operations:**
```typescript
async function getAssignedTasks(): Promise<ClickUpTask[]>
async function updateTaskStatus(taskId: string, statusId: string): Promise<void>
async function addComment(taskId: string, text: string): Promise<void>
async function getTaskComments(taskId: string): Promise<Comment[]>
function parseCommand(commentText: string): Command | null
function detectRepository(task: ClickUpTask): string | null
```

**Authentication:** Bearer token via `CLICKUP_API_KEY`

#### GitHub API Client
**File:** `lib/github.ts` (legacy - being migrated to `src/infrastructure/api/github.client.ts`)

**Key Operations:**
```typescript
async function createBranch(branchName: string, baseBranch: string): Promise<void>
async function createPR(title: string, body: string, headBranch: string): Promise<PR>
async function getPRByBranch(branchName: string): Promise<PR | null>
async function addPRComment(prNumber: number, comment: string): Promise<void>
async function deleteBranch(branchName: string): Promise<void>
```

**Authentication:** Personal access token via `GITHUB_TOKEN`

---

## Development Workflows

### Setting Up Development Environment

```bash
# 1. Clone repository
git clone https://github.com/yourusername/timmy.git
cd timmy

# 2. Install dependencies
npm install

# 3. Configure environment
npm run init  # Interactive setup (recommended)
# OR
npm run setup  # Manual setup

# 4. Build project
npm run build

# 5. Run tests
npm test
```

### Common Development Commands

```bash
# Development
npm run dev              # Run with ts-node (development mode)
npm run build            # Compile TypeScript to dist/
npm start                # Build and run production

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm test -- --coverage   # Run with coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run type-check       # Type check without emitting

# Project Management
npm run projects         # List all projects
npm run switch <name>    # Switch active project
npm run current          # Show current project

# Cleanup
npm run clean            # Remove dist/ directory
```

### Git Workflow

**Branch Naming Convention:**
```
feature/task-{taskId}-{short-description}
fix/task-{taskId}-{short-description}
refactor/{description}
docs/{description}
```

**Commit Message Format (Conventional Commits):**
```
feat: add new feature
fix: fix bug in module
docs: update documentation
refactor: restructure code
test: add tests
chore: maintenance tasks
```

**Example:**
```bash
git checkout -b feature/task-123-user-authentication
git commit -m "feat: add user authentication with JWT"
git push origin feature/task-123-user-authentication
```

---

## Key Conventions

### 1. TypeScript Conventions

#### Strict Mode Configuration
```json
{
  "strict": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "forceConsistentCasingInFileNames": true
}
```

#### Path Aliases (ALWAYS USE THESE)
```typescript
// ❌ BAD - Relative imports
import { timmy } from '../../../src/shared/ui';
import type { ClickUpTask } from '../../../src/types/clickup';

// ✅ GOOD - Path aliases
import { timmy } from '@/shared/ui';
import type { ClickUpTask } from '@/types/clickup';
```

**Available Aliases:**
- `@/types/*` → `src/types/*`
- `@/shared/*` → `src/shared/*`
- `@/core/*` → `src/core/*`
- `@/infrastructure/*` → `src/infrastructure/*`

#### Type Imports
```typescript
// ✅ Use 'type' keyword for type-only imports
import type { ClickUpTask, Comment } from '@/types/clickup';
import type { LaunchOptions } from '@/types/ai';

// ✅ Named imports for values
import { timmy, colors } from '@/shared/ui';
import config from '@/shared/config';
```

### 2. Error Handling

#### Use Custom Error Classes
**Location:** `src/shared/errors/`

```typescript
// ✅ GOOD - Custom error classes
import { APIError } from '@/shared/errors/api.error';
import { ValidationError } from '@/shared/errors/validation.error';
import { StorageError } from '@/shared/errors/storage.error';

throw new APIError('Failed to fetch tasks', 500);
throw new ValidationError('Invalid task ID');
throw new StorageError('Cannot read pipeline state', filePath);
```

```typescript
// ❌ BAD - Generic errors
throw new Error('Something went wrong');
```

#### Error Hierarchy
```
BaseError (base.error.ts)
├── APIError (api.error.ts)
│   ├── GitHubAPIError
│   └── ClickUpAPIError
├── ValidationError (validation.error.ts)
├── StorageError (storage.error.ts)
├── RepositoryError (repository.error.ts)
└── AIError (ai.error.ts)
```

#### Async Error Handling Pattern
```typescript
// ✅ GOOD - Propagate errors
async function loadData(): Promise<Data> {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new StorageError('Failed to load data', filePath, error as Error);
  }
}
```

```typescript
// ❌ BAD - Silent failures
async function loadData(): Promise<Data | null> {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error:', error);
    return null;  // ❌ Silent failure
  }
}
```

### 3. Logging Conventions

#### Use Logger Utility (NOT console.log)
**File:** `src/shared/utils/logger.util.ts`

```typescript
// ✅ GOOD - Use logger utility
import { logger } from '@/shared/utils/logger.util';

logger.info('Processing task', { taskId });
logger.error('Failed to process', error);
logger.warn('Retrying operation', { attempt: 2 });
```

```typescript
// ❌ BAD - Direct console usage (DO NOT USE)
console.log('Processing task');
console.error('Failed to process:', error);
```

#### UI Formatting for User-Facing Output
```typescript
import { timmy, colors } from '@/shared/ui';

console.log(timmy.info('Task detected'));
console.log(timmy.success('✓ Implementation complete'));
console.log(timmy.error('✗ Failed to create PR'));
console.log(timmy.ai('🤖 Claude is thinking...'));
```

### 4. File Operations

#### Prefer Async Operations
```typescript
// ✅ GOOD - Async file operations
import fs from 'fs/promises';

async function saveData(data: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function loadData(): Promise<any> {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}
```

```typescript
// ❌ BAD - Sync operations (blocks event loop)
import fs from 'fs';

function saveData(data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
```

### 5. Retry Logic

#### Use Retry Utility for Network Operations
**File:** `src/shared/utils/retry.util.ts`

```typescript
import { withRetry } from '@/shared/utils/retry.util';

// ✅ Automatic retry with exponential backoff
const result = await withRetry(
  () => apiClient.get('/endpoint'),
  {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2
  }
);
```

### 6. Function Size & Complexity

#### Single Responsibility Principle
```typescript
// ✅ GOOD - Small, focused functions
async function processTask(task: ClickUpTask): Promise<void> {
  await validateTask(task);
  const analysis = await analyzeTask(task);
  const implementation = await implementFeature(task, analysis);
  await reviewCode(implementation);
  await createPullRequest(implementation);
}

// Each helper function handles ONE responsibility
```

```typescript
// ❌ BAD - God function (>100 lines)
async function processTask(task: ClickUpTask): Promise<void> {
  // 300 lines of mixed concerns
  // Validation + Analysis + Implementation + Review + PR creation
}
```

**Rule of Thumb:** Functions should be <50 lines. If larger, split into helper functions.

### 7. Testing Conventions

#### Test File Naming
```
src/
├── core/
│   └── repositories/
│       ├── cache.repository.ts
│       └── __tests__/
│           └── cache.repository.test.ts
```

#### Test Structure
```typescript
describe('CacheRepository', () => {
  describe('add', () => {
    it('should add task to cache', async () => {
      // Arrange
      const repo = new CacheRepository(testFilePath);
      const task = createMockTask();

      // Act
      await repo.add(task);

      // Assert
      expect(repo.has(task.id)).toBe(true);
    });

    it('should throw error for duplicate task', async () => {
      // ...
    });
  });
});
```

#### Mock External Dependencies
```typescript
// Mock API clients
jest.mock('@/infrastructure/api/clickup.client');
jest.mock('@/infrastructure/api/github.client');

// Mock file system
jest.mock('fs/promises');
```

---

## Common Tasks

### Task 1: Adding a New Pipeline Stage

**Example:** Add a "testing" stage after implementation

1. **Create stage file:**
```typescript
// src/core/orchestrator/stages/testing.stage.ts
import type { ClickUpTask } from '@/types/clickup';
import type { StageContext } from '@/types/orchestrator';
import * as testRunner from '@/core/ai-services/test-runner.service';

export async function executeTestingStage(
  task: ClickUpTask,
  context: StageContext
): Promise<void> {
  const { taskId, repoPath, branch } = context;

  // Run tests
  const results = await testRunner.runTests(repoPath, branch);

  // Update pipeline state
  context.pipeline.updateStageMetadata('testing', {
    testsRun: results.total,
    testsPassed: results.passed,
    testsFailed: results.failed
  });
}
```

2. **Update orchestrator:**
```typescript
// src/core/orchestrator/orchestrator.service.ts
import { executeTestingStage } from './stages/testing.stage';

async function processTask(task: ClickUpTask): Promise<void> {
  // ... existing stages ...

  await executeImplementationStage(task, context);

  // Add new stage
  await executeTestingStage(task, context);

  await executeReviewStage(task, context);
  // ...
}
```

3. **Update pipeline types:**
```typescript
// src/types/storage.ts
export type PipelineStage =
  | 'detected'
  | 'analyzing'
  | 'analyzing_fallback'
  | 'analyzed'
  | 'implementing'
  | 'implemented'
  | 'testing'      // Add new stage
  | 'codex_reviewing'
  // ...
```

### Task 2: Adding a New AI Service

**Example:** Add OpenAI integration

1. **Create service file:**
```typescript
// src/core/ai-services/openai.service.ts
import type { ClickUpTask } from '@/types/clickup';
import type { LaunchOptions } from '@/types/ai';
import config from '@/shared/config';

export async function analyzeWithOpenAI(
  task: ClickUpTask,
  options: LaunchOptions
): Promise<string> {
  // Load context
  const context = await loadSmartContext(options.repoPath);

  // Build prompt
  const prompt = buildAnalysisPrompt(task, context);

  // Call OpenAI API
  const response = await callOpenAI(prompt);

  return response;
}

async function callOpenAI(prompt: string): Promise<string> {
  // Implementation
}
```

2. **Add to orchestrator:**
```typescript
// src/core/orchestrator/stages/analysis.stage.ts
import * as openai from '@/core/ai-services/openai.service';

export async function executeAnalysisStage(
  task: ClickUpTask,
  context: StageContext
): Promise<void> {
  // Try OpenAI first
  const analysis = await openai.analyzeWithOpenAI(task, options);
  // ...
}
```

### Task 3: Adding a New Repository Type

**Example:** Add metrics tracking repository

1. **Create repository file:**
```typescript
// src/core/repositories/metrics.repository.ts
import type { Metric } from '@/types/metrics';
import { RepositoryError } from '@/shared/errors/repository.error';
import fs from 'fs/promises';

export class MetricsRepository {
  constructor(private readonly filePath: string) {}

  async track(metric: Metric): Promise<void> {
    try {
      const metrics = await this.load();
      metrics.push(metric);
      await this.save(metrics);
    } catch (error) {
      throw new RepositoryError('Failed to track metric', error as Error);
    }
  }

  private async load(): Promise<Metric[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private async save(metrics: Metric[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(metrics, null, 2));
  }
}
```

2. **Add tests:**
```typescript
// src/core/repositories/__tests__/metrics.repository.test.ts
describe('MetricsRepository', () => {
  // Test implementation
});
```

### Task 4: Fixing Bugs

**Standard Bug Fix Workflow:**

1. **Reproduce the bug** - Write a failing test
2. **Identify root cause** - Use debugger or logging
3. **Fix the issue** - Minimal code change
4. **Verify fix** - Test passes
5. **Check side effects** - Run full test suite
6. **Document** - Add comments if needed

**Example:**
```typescript
// 1. Write failing test
it('should handle missing task description', () => {
  const task = { id: '123', title: 'Test' }; // No description
  expect(() => processTask(task)).not.toThrow();
});

// 2. Fix code
function processTask(task: ClickUpTask): void {
  const description = task.description || 'No description provided';
  // ...
}

// 3. Verify test passes
```

### Task 5: Adding Configuration Options

**Example:** Add a new environment variable

1. **Update .env file:**
```bash
# Add new variable
ENABLE_SLACK_NOTIFICATIONS=true
```

2. **Update config module:**
```typescript
// src/shared/config/index.ts
export default {
  // ... existing config
  notifications: {
    slack: {
      enabled: process.env.ENABLE_SLACK_NOTIFICATIONS === 'true',
      webhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    }
  }
};
```

3. **Update types:**
```typescript
// src/types/config.ts
export interface Config {
  // ... existing
  notifications: {
    slack: {
      enabled: boolean;
      webhookUrl: string;
    };
  };
}
```

4. **Use in code:**
```typescript
import config from '@/shared/config';

if (config.notifications.slack.enabled) {
  await sendSlackNotification(message);
}
```

---

## Configuration Management

### Environment Variables (.env)

```bash
# ClickUp Configuration
CLICKUP_API_KEY=pk_your_api_key_here
CLICKUP_WORKSPACE_ID=12345678
CLICKUP_BOT_USER_ID=12345678

# GitHub Configuration
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=username
GITHUB_REPO=repository-name
GITHUB_REPO_PATH=/absolute/path/to/repo
GITHUB_BASE_BRANCH=main

# System Configuration
POLL_INTERVAL_MS=60000           # Poll every 60 seconds
CLAUDE_CLI_PATH=claude           # Path to Claude CLI
GEMINI_CLI_PATH=gemini           # Path to Gemini CLI
CODEX_CLI_PATH=codex             # Path to Codex CLI
QWEN_CLI_PATH=qwen               # Path to Qwen CLI

# Optional Configuration
DISABLE_COMMENTS=false           # Disable ClickUp comment posting
```

### Multi-Project Configuration

**Workspace Configuration (`workspace.json`):**
```json
{
  "active": "my-app",
  "comment": "Tracks currently active project"
}
```

**Projects Configuration (`projects.json`):**
```json
{
  "projects": {
    "my-app": {
      "name": "My Application",
      "description": "Main application",
      "clickup": {
        "workspaceId": "12345678"
      },
      "github": {
        "owner": "myorg",
        "repo": "my-app",
        "path": "/Users/me/projects/my-app",
        "baseBranch": "main"
      }
    },
    "other-project": {
      "name": "Other Project",
      "description": "Secondary project",
      "clickup": {
        "workspaceId": "87654321"
      },
      "github": {
        "owner": "myorg",
        "repo": "other-project",
        "path": "/Users/me/projects/other-project",
        "baseBranch": "develop"
      }
    }
  }
}
```

**Switching Projects:**
```bash
npm run projects        # List all projects
npm run switch my-app   # Switch to my-app
npm run current         # Show current project
```

### Configuration Resolution

**Priority Order (highest to lowest):**
1. Active project config from `projects.json`
2. `.env` file variables
3. Default values in code

**Access Configuration:**
```typescript
import config from '@/shared/config';

// ClickUp config
config.clickup.apiKey
config.clickup.workspaceId
config.clickup.botUserId

// GitHub config
config.github.owner
config.github.repo
config.github.repoPath
config.github.token
config.github.baseBranch

// System config
config.system.pollIntervalMs
config.system.claudeCliPath
```

---

## Testing Strategy

### Testing Philosophy

1. **Test business logic thoroughly** - Core logic should have high coverage
2. **Mock external dependencies** - Don't call real APIs in tests
3. **Test error conditions** - Test failure paths, not just happy paths
4. **Integration tests for workflows** - Test multi-component interactions
5. **Keep tests fast** - Fast tests = run tests frequently

### Test Coverage Requirements

**Current Thresholds (package.json):**
```json
{
  "coverageThreshold": {
    "global": {
      "statements": 30,
      "branches": 25,
      "functions": 30,
      "lines": 30
    }
  }
}
```

**⚠️ Note:** These thresholds are LOW. Aim for 70-80% coverage in new code.

### Test Organization

```
src/
├── core/
│   ├── repositories/
│   │   ├── cache.repository.ts
│   │   └── __tests__/
│   │       └── cache.repository.test.ts
│   └── orchestrator/
│       ├── orchestrator.service.ts
│       └── __tests__/
│           └── orchestrator.service.test.ts
└── __tests__/
    └── integration/
        ├── repository-integration.test.ts
        └── task-flow.test.ts
```

### Writing Tests

**Unit Test Example:**
```typescript
// src/core/repositories/__tests__/cache.repository.test.ts
import { CacheRepository } from '../cache.repository';
import type { ClickUpTask } from '@/types/clickup';
import fs from 'fs/promises';

jest.mock('fs/promises');

describe('CacheRepository', () => {
  let repo: CacheRepository;
  const testFile = '/tmp/test-cache.json';

  beforeEach(() => {
    repo = new CacheRepository(testFile);
    jest.clearAllMocks();
  });

  describe('add', () => {
    it('should add task to cache', async () => {
      const task: ClickUpTask = {
        id: '123',
        name: 'Test Task',
        description: 'Test description'
      };

      await repo.add(task);

      expect(repo.has('123')).toBe(true);
    });

    it('should not add duplicate task', async () => {
      const task: ClickUpTask = { id: '123', name: 'Test' };

      await repo.add(task);
      await repo.add(task);

      const cache = await repo.load();
      expect(cache.length).toBe(1);
    });
  });
});
```

**Integration Test Example:**
```typescript
// src/__tests__/integration/task-flow.test.ts
import * as orchestrator from '@/core/orchestrator/orchestrator.service';
import type { ClickUpTask } from '@/types/clickup';

describe('Task Flow Integration', () => {
  it('should process task through full pipeline', async () => {
    const task: ClickUpTask = {
      id: '123',
      name: 'Add login feature',
      description: 'Implement user authentication'
    };

    const result = await orchestrator.processTask(task);

    expect(result.success).toBe(true);
    expect(result.pipeline?.currentStage).toBe('completed');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- cache.repository.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run only integration tests
npm test -- --testPathPattern=integration
```

---

## Important Notes for AI Assistants

### ⚠️ Critical Migration Status

**IMPORTANT:** This codebase is undergoing a migration from `lib/` (legacy) to `src/` (modern).

**Current State:**
- Main entry point (`timmy.ts`) imports from BOTH `lib/` and `src/`
- ~1,500+ lines of code duplicated between old and new implementations
- New features should ONLY use `src/` modules

**What to Do:**
✅ **DO:**
- Use modules from `src/` directory
- Import from `@/shared/`, `@/core/`, `@/infrastructure/`, `@/types/`
- Follow modern patterns in `src/`

❌ **DON'T:**
- Add new code to `lib/` directory
- Import from `lib/` in new code
- Modify `lib/` files unless migrating them to `src/`

**Files to Avoid (Legacy):**
- `lib/clickup.ts` → Use `src/infrastructure/api/clickup.client.ts`
- `lib/github.ts` → Use `src/infrastructure/api/github.client.ts`
- `lib/storage/*` → Use `src/core/repositories/*`

### 🗑️ Unused Code to Ignore

**These modules exist but are NEVER USED:**
- `src/core/rag/` - RAG system (~600 lines, completely unused)
- `src/core/process-manager/` - Process management (placeholder)
- `src/core/qwen.service.ts` - Test generation (disabled)

**Don't reference or modify these unless explicitly asked.**

### 🎯 Common Pitfalls to Avoid

1. **Don't use `console.log` directly**
   - Use `logger` from `@/shared/utils/logger.util` OR
   - Use `timmy` from `@/shared/ui` for user-facing messages

2. **Don't use relative imports**
   - ❌ `import { timmy } from '../../../src/shared/ui'`
   - ✅ `import { timmy } from '@/shared/ui'`

3. **Don't use sync file operations**
   - ❌ `fs.readFileSync()`
   - ✅ `await fs.promises.readFile()`

4. **Don't throw generic errors**
   - ❌ `throw new Error('Failed')`
   - ✅ `throw new APIError('Failed to fetch tasks', 500)`

5. **Don't write God functions**
   - Keep functions under 50 lines
   - One function = one responsibility

### 🔍 Understanding Data Flow

**When tracking down issues, follow this sequence:**

1. **Entry Point:** `timmy.ts` - Main polling loop
2. **Orchestrator:** `orchestrator.service.ts` - Pipeline coordination
3. **Stages:** `orchestrator/stages/*.stage.ts` - Individual stage execution
4. **Services:** `ai-services/*.service.ts` - AI tool integrations
5. **Repositories:** `repositories/*.repository.ts` - Data persistence
6. **Infrastructure:** `infrastructure/api/*.client.ts` - External APIs

**State Files to Check:**
- `data/state/pipeline-state.json` - Current pipeline status
- `data/cache/processed-tasks.json` - Processed tasks
- `data/tracking/pr-tracking.json` - PR creation status

### 📝 Code Review Checklist

When reviewing or writing code, verify:

- [ ] Uses TypeScript path aliases (`@/...`)
- [ ] Uses custom error classes, not generic `Error`
- [ ] Uses `logger` or `timmy`, not `console.log`
- [ ] Uses async file operations, not sync
- [ ] Functions are small (<50 lines ideally)
- [ ] Has appropriate error handling
- [ ] Has tests for new functionality
- [ ] Imports from `src/`, not `lib/`
- [ ] Follows conventional commit format
- [ ] No hardcoded values (uses config)

### 🚀 Performance Considerations

**Polling Interval:**
- Default: 60 seconds (configured via `POLL_INTERVAL_MS`)
- Don't poll faster than 15 seconds to avoid rate limits

**Retry Logic:**
- All API calls should use retry utility
- Default: 3 attempts with exponential backoff
- Max backoff: 8 seconds

**File Operations:**
- Always use async operations
- Avoid reading large files into memory
- Use streaming for large data

### 🔐 Security Considerations

**Sensitive Data:**
- Never commit `.env` file
- Never log API keys or tokens
- Store credentials in environment variables only

**API Rate Limits:**
- ClickUp: 100 requests per minute
- GitHub: 5,000 requests per hour (authenticated)
- Implement retry with backoff on rate limit errors

**Input Validation:**
- Always validate task data before processing
- Sanitize user input before executing commands
- Use validation utility: `@/shared/utils/validation.util`

---

## Quick Reference

### Key Files by Function

| Function | File | Purpose |
|----------|------|---------|
| **Entry Point** | `timmy.ts` | Main application loop |
| **Orchestration** | `src/core/orchestrator/orchestrator.service.ts` | Pipeline coordination |
| **ClickUp API** | `lib/clickup.ts` | ClickUp integration (legacy) |
| **GitHub API** | `lib/github.ts` | GitHub integration (legacy) |
| **Claude Integration** | `src/core/ai-services/claude.service.ts` | Claude Code launcher |
| **Gemini Integration** | `src/core/ai-services/gemini.service.ts` | Gemini analysis |
| **Pipeline State** | `src/core/repositories/pipeline.repository.ts` | Pipeline state management |
| **Configuration** | `src/shared/config/index.ts` | Config management |
| **Error Classes** | `src/shared/errors/` | Custom error types |
| **Types** | `src/types/` | TypeScript definitions |

### Common Import Patterns

```typescript
// Configuration
import config from '@/shared/config';

// UI/Logging
import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';

// Types
import type { ClickUpTask, Comment } from '@/types/clickup';
import type { LaunchOptions } from '@/types/ai';
import type { PipelineData } from '@/types/storage';

// Utilities
import { withRetry } from '@/shared/utils/retry.util';
import { validateTask } from '@/shared/utils/validation.util';

// Errors
import { APIError } from '@/shared/errors/api.error';
import { ValidationError } from '@/shared/errors/validation.error';

// Services
import * as claude from '@/core/ai-services/claude.service';
import * as orchestrator from '@/core/orchestrator/orchestrator.service';

// Repositories
import { CacheRepository } from '@/core/repositories/cache.repository';
import { PipelineRepository } from '@/core/repositories/pipeline.repository';
```

### Environment Variables Quick Reference

```bash
# Required
CLICKUP_API_KEY=xxx
CLICKUP_WORKSPACE_ID=xxx
CLICKUP_BOT_USER_ID=xxx
GITHUB_TOKEN=xxx
GITHUB_OWNER=xxx
GITHUB_REPO=xxx
GITHUB_REPO_PATH=xxx

# Optional
POLL_INTERVAL_MS=60000
GITHUB_BASE_BRANCH=main
CLAUDE_CLI_PATH=claude
GEMINI_CLI_PATH=gemini
CODEX_CLI_PATH=codex
DISABLE_COMMENTS=false
```

### Pipeline Stages Flow

```
DETECTED
  ↓
ANALYZING (Gemini)
  ↓
ANALYZED
  ↓
IMPLEMENTING (Claude)
  ↓
IMPLEMENTED
  ↓
CODEX_REVIEWING (Codex)
  ↓
CODEX_REVIEWED
  ↓
CLAUDE_FIXING (Claude)
  ↓
CLAUDE_FIXED
  ↓
PR_CREATING (GitHub)
  ↓
COMPLETED
```

### Error Types Quick Reference

```typescript
throw new APIError(message, statusCode)         // API failures
throw new GitHubAPIError(message)                // GitHub-specific
throw new ClickUpAPIError(message)               // ClickUp-specific
throw new ValidationError(message)               // Invalid data
throw new StorageError(message, filePath, err)   // File I/O errors
throw new RepositoryError(message, err)          // Repository errors
throw new AIError(message, service)              // AI service errors
```

---

## Conclusion

This guide provides a comprehensive overview of the Timmy codebase for AI assistants. Key takeaways:

1. **Architecture:** Multi-layer architecture with clear separation of concerns
2. **Migration:** Actively migrating from `lib/` to `src/` - use `src/` only
3. **Conventions:** Strict TypeScript, path aliases, custom errors, async operations
4. **Testing:** Write tests for new code, aim for 70%+ coverage
5. **Data Flow:** ClickUp → Orchestrator → AI Services → GitHub

When in doubt:
- Check existing patterns in `src/` directory
- Use path aliases for imports
- Use custom error classes
- Keep functions small and focused
- Write tests

**Last Updated:** 2025-11-15
**Maintained By:** Timmy Development Team

---

*This document should be updated whenever significant architectural changes are made to the codebase.*
