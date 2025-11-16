#!/usr/bin/env ts-node

/**
 * JSON to SQLite Migration Script
 * Migrates all existing JSON data to SQLite database
 *
 * Usage: npm run migrate:json-to-sqlite
 */

import fs from 'fs';
import path from 'path';
import { getSQLiteClient, closeSQLiteClient } from '../src/infrastructure/storage/sqlite.client';
import { PipelineRepository } from '../src/infrastructure/storage/repositories/pipeline.repository';
import { QueueRepository } from '../src/infrastructure/storage/repositories/queue.repository';
import { CacheRepository, CommentCacheRepository } from '../src/infrastructure/storage/repositories/cache.repository';
import { ReviewTrackingRepository, PRTrackingRepository } from '../src/infrastructure/storage/repositories/tracking.repository';

interface MigrationStats {
  pipelines: number;
  stages: number;
  metadata: number;
  errors: number;
  queue: number;
  cache: number;
  comments: number;
  reviews: number;
  prTracking: number;
  failed: string[];
}

const stats: MigrationStats = {
  pipelines: 0,
  stages: 0,
  metadata: 0,
  errors: 0,
  queue: 0,
  cache: 0,
  comments: 0,
  reviews: 0,
  prTracking: 0,
  failed: []
};

/**
 * Read JSON file safely
 */
function readJSON(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, (error as Error).message);
    stats.failed.push(filePath);
    return null;
  }
}

/**
 * Migrate pipeline state
 */
function migratePipelines(_pipelineRepo: PipelineRepository): void {
  console.log('\n📦 Migrating pipeline state...');

  const pipelineFile = 'data/state/pipeline-state.json';
  const data = readJSON(pipelineFile);

  if (!data) return;

  const db = getSQLiteClient().getDB();

  db.transaction(() => {
    for (const [taskId, pipeline] of Object.entries(data as Record<string, any>)) {
      try {
        // Insert pipeline
        db.prepare(`
          INSERT INTO pipelines (
            task_id, task_name, current_stage, status,
            created_at, updated_at, completed_at, failed_at, total_duration, repository
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          pipeline.taskId || taskId,
          pipeline.taskName || 'Unknown',
          pipeline.currentStage || 'unknown',
          pipeline.status || 'pending',
          pipeline.createdAt || new Date().toISOString(),
          pipeline.updatedAt || new Date().toISOString(),
          pipeline.completedAt || null,
          pipeline.failedAt || null,
          pipeline.totalDuration || null,
          pipeline.repository || null
        );
        stats.pipelines++;

        // Insert stages
        if (pipeline.stages && Array.isArray(pipeline.stages)) {
          for (const stage of pipeline.stages) {
            db.prepare(`
              INSERT INTO stages (
                pipeline_task_id, name, stage, status,
                started_at, completed_at, duration, error
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              taskId,
              stage.name || stage.stage || 'unknown',
              stage.stage || 'unknown',
              stage.status || 'pending',
              stage.startedAt || new Date().toISOString(),
              stage.completedAt || null,
              stage.duration || null,
              stage.error || null
            );
            stats.stages++;
          }
        }

        // Insert metadata
        const metadata = pipeline.metadata || {};
        db.prepare(`
          INSERT INTO pipeline_metadata (
            pipeline_task_id, gemini_analysis_file, gemini_analysis_fallback,
            pr_number, review_iterations, max_review_iterations,
            branches, agent_execution
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          taskId,
          metadata.geminiAnalysis?.file || null,
          metadata.geminiAnalysis?.fallback ? 1 : 0,
          metadata.prNumber || null,
          metadata.reviewIterations || 0,
          metadata.maxReviewIterations || 3,
          metadata.branches ? JSON.stringify(metadata.branches) : null,
          metadata.agentExecution ? JSON.stringify(metadata.agentExecution) : null
        );
        stats.metadata++;

        // Insert errors
        if (pipeline.errors && Array.isArray(pipeline.errors)) {
          for (const error of pipeline.errors) {
            db.prepare(`
              INSERT INTO pipeline_errors (
                pipeline_task_id, stage, error, timestamp
              ) VALUES (?, ?, ?, ?)
            `).run(
              taskId,
              error.stage || 'unknown',
              error.message || error.error || 'Unknown error',
              error.timestamp || new Date().toISOString()
            );
            stats.errors++;
          }
        }

        console.log(`  ✓ Migrated pipeline: ${taskId}`);
      } catch (error) {
        console.error(`  ❌ Failed to migrate pipeline ${taskId}:`, (error as Error).message);
        stats.failed.push(`pipeline:${taskId}`);
      }
    }
  })();
}

/**
 * Migrate task queue
 */
function migrateQueue(_queueRepo: QueueRepository): void {
  console.log('\n📦 Migrating task queue...');

  const queueFile = 'data/state/task-queue.json';
  const data = readJSON(queueFile);

  if (!data) return;

  const db = getSQLiteClient().getDB();

  db.transaction(() => {
    // Migrate pending tasks
    if (data.pending && Array.isArray(data.pending)) {
      for (const task of data.pending) {
        try {
          db.prepare(`
            INSERT INTO queue (
              id, title, description, url, queued_at, status,
              repo_path, owner, repo, branch, commit_message, pr_title, pr_body, priority
            ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            task.id,
            task.title || 'Unknown',
            task.description || null,
            task.url || null,
            task.queuedAt || new Date().toISOString(),
            task.repoPath || null,
            task.owner || null,
            task.repo || null,
            task.branch || 'main',
            task.commitMessage || '',
            task.prTitle || '',
            task.prBody || null,
            0
          );
          stats.queue++;
          console.log(`  ✓ Migrated pending task: ${task.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to migrate task ${task.id}:`, (error as Error).message);
          stats.failed.push(`queue:${task.id}`);
        }
      }
    }

    // Migrate completed tasks
    if (data.completed && Array.isArray(data.completed)) {
      for (const task of data.completed) {
        try {
          db.prepare(`
            INSERT INTO queue (
              id, title, description, url, queued_at, completed_at, status,
              repo_path, owner, repo, branch, commit_message, pr_title, pr_body, priority
            ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            task.id,
            task.title || 'Unknown',
            task.description || null,
            task.url || null,
            task.queuedAt || new Date().toISOString(),
            task.completedAt || new Date().toISOString(),
            task.repoPath || null,
            task.owner || null,
            task.repo || null,
            task.branch || 'main',
            task.commitMessage || '',
            task.prTitle || '',
            task.prBody || null,
            0
          );
          stats.queue++;
          console.log(`  ✓ Migrated completed task: ${task.id}`);
        } catch (error) {
          console.error(`  ❌ Failed to migrate task ${task.id}:`, (error as Error).message);
          stats.failed.push(`queue:${task.id}`);
        }
      }
    }
  })();
}

/**
 * Migrate processed tasks cache
 */
function migrateCache(_cacheRepo: CacheRepository): void {
  console.log('\n📦 Migrating processed tasks cache...');

  const cacheFile = 'data/cache/processed-tasks.json';
  const data = readJSON(cacheFile);

  if (!data || !Array.isArray(data)) return;

  const db = getSQLiteClient().getDB();

  db.transaction(() => {
    for (const task of data) {
      try {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
          INSERT INTO processed_tasks (id, title, description, detected_at, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          task.id,
          task.title || 'Unknown',
          task.description || null,
          task.detectedAt || new Date().toISOString(),
          expiresAt
        );
        stats.cache++;
        console.log(`  ✓ Migrated cached task: ${task.id}`);
      } catch (error) {
        console.error(`  ❌ Failed to migrate cache ${task.id}:`, (error as Error).message);
        stats.failed.push(`cache:${task.id}`);
      }
    }
  })();
}

/**
 * Migrate processed comments
 */
function migrateComments(_commentRepo: CommentCacheRepository): void {
  console.log('\n📦 Migrating processed comments...');

  const commentsFile = 'data/cache/processed-comments.json';
  const data = readJSON(commentsFile);

  if (!data || !Array.isArray(data)) return;

  const db = getSQLiteClient().getDB();

  db.transaction(() => {
    for (const commentId of data) {
      try {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
          INSERT INTO processed_comments (comment_id, processed_at, expires_at)
          VALUES (?, ?, ?)
        `).run(
          commentId,
          new Date().toISOString(),
          expiresAt
        );
        stats.comments++;
      } catch (error) {
        console.error(`  ❌ Failed to migrate comment ${commentId}:`, (error as Error).message);
        stats.failed.push(`comment:${commentId}`);
      }
    }
  })();

  console.log(`  ✓ Migrated ${stats.comments} comments`);
}

/**
 * Migrate review tracking
 */
function migrateReviews(_reviewRepo: ReviewTrackingRepository): void {
  console.log('\n📦 Migrating review tracking...');

  const reviewFile = 'data/tracking/review-tracking.json';
  const data = readJSON(reviewFile);

  if (!data || !Array.isArray(data)) return;

  const db = getSQLiteClient().getDB();

  db.transaction(() => {
    for (const review of data) {
      try {
        db.prepare(`
          INSERT INTO reviews (
            task_id, task_name, branch, pr_number, pr_url, stage,
            iteration, max_iterations, started_at, last_commit_sha, last_checked_at,
            repository, owner, repo, repo_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          review.taskId,
          review.taskName || 'Unknown',
          review.branch,
          review.prNumber,
          review.prUrl,
          review.stage || 'waiting_for_codex_review',
          review.iteration || 0,
          review.maxIterations || 3,
          review.startedAt || new Date().toISOString(),
          review.lastCommitSha || null,
          review.lastCheckedAt || null,
          review.repository || null,
          review.owner || null,
          review.repo || null,
          review.repoPath || null
        );
        stats.reviews++;
        console.log(`  ✓ Migrated review: ${review.taskId}`);
      } catch (error) {
        console.error(`  ❌ Failed to migrate review ${review.taskId}:`, (error as Error).message);
        stats.failed.push(`review:${review.taskId}`);
      }
    }
  })();
}

/**
 * Migrate PR tracking
 */
function migratePRTracking(_prRepo: PRTrackingRepository): void {
  console.log('\n📦 Migrating PR tracking...');

  const prFile = 'data/tracking/pr-tracking.json';
  const data = readJSON(prFile);

  if (!data || !Array.isArray(data)) return;

  const db = getSQLiteClient().getDB();

  db.transaction(() => {
    for (const pr of data) {
      try {
        db.prepare(`
          INSERT INTO pr_tracking (
            task_id, task_name, branch, started_at, pr_number, pr_url, last_checked_at,
            repository, owner, repo, repo_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          pr.taskId,
          pr.taskName || 'Unknown',
          pr.branch,
          pr.startedAt || new Date().toISOString(),
          pr.prNumber || null,
          pr.prUrl || null,
          pr.lastCheckedAt || null,
          pr.repository || null,
          pr.owner || null,
          pr.repo || null,
          pr.repoPath || null
        );
        stats.prTracking++;
        console.log(`  ✓ Migrated PR tracking: ${pr.taskId}`);
      } catch (error) {
        console.error(`  ❌ Failed to migrate PR ${pr.taskId}:`, (error as Error).message);
        stats.failed.push(`pr:${pr.taskId}`);
      }
    }
  })();
}

/**
 * Backup JSON files
 */
function backupJSONFiles(): void {
  console.log('\n💾 Backing up JSON files...');

  const backupDir = `data/backup-${Date.now()}`;
  fs.mkdirSync(backupDir, { recursive: true });

  const files = [
    'data/state/pipeline-state.json',
    'data/state/task-queue.json',
    'data/cache/processed-tasks.json',
    'data/cache/processed-comments.json',
    'data/tracking/review-tracking.json',
    'data/tracking/pr-tracking.json'
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      const dest = path.join(backupDir, path.basename(file));
      fs.copyFileSync(file, dest);
      console.log(`  ✓ Backed up: ${file} → ${dest}`);
    }
  }

  console.log(`\n✅ Backups saved to: ${backupDir}`);
}

/**
 * Print migration summary
 */
function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Pipelines:        ${stats.pipelines}`);
  console.log(`  Stages:         ${stats.stages}`);
  console.log(`  Metadata:       ${stats.metadata}`);
  console.log(`  Errors:         ${stats.errors}`);
  console.log(`Queue Tasks:      ${stats.queue}`);
  console.log(`Cached Tasks:     ${stats.cache}`);
  console.log(`Cached Comments:  ${stats.comments}`);
  console.log(`Reviews:          ${stats.reviews}`);
  console.log(`PR Tracking:      ${stats.prTracking}`);
  console.log('='.repeat(60));

  if (stats.failed.length > 0) {
    console.log(`\n⚠️  ${stats.failed.length} items failed to migrate:`);
    stats.failed.forEach(item => console.log(`  - ${item}`));
  } else {
    console.log('\n✅ All items migrated successfully!');
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting JSON to SQLite migration...\n');

  try {
    // Backup existing JSON files
    backupJSONFiles();

    // Initialize repositories
    const pipelineRepo = new PipelineRepository();
    const queueRepo = new QueueRepository();
    const cacheRepo = new CacheRepository();
    const commentRepo = new CommentCacheRepository();
    const reviewRepo = new ReviewTrackingRepository();
    const prRepo = new PRTrackingRepository();

    // Run migrations
    migratePipelines(pipelineRepo);
    migrateQueue(queueRepo);
    migrateCache(cacheRepo);
    migrateComments(commentRepo);
    migrateReviews(reviewRepo);
    migratePRTracking(prRepo);

    // Print summary
    printSummary();

    // Close database
    closeSQLiteClient();

    console.log('\n✅ Migration complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    closeSQLiteClient();
    process.exit(1);
  }
}

// Run migration
main();
