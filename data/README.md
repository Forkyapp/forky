# Data Directory Structure

This directory contains all runtime state and cache files for Timmy. All files in this directory are excluded from version control.

## Directory Organization

```
data/
├── cache/              # Deduplication and processed item caches
│   ├── processed-tasks.json
│   └── processed-comments.json
│
├── state/              # Application state and queues
│   ├── task-queue.json
│   └── pipeline-state.json
│
└── tracking/           # Progress and status tracking
    ├── pr-tracking.json
    └── review-tracking.json
```

## File Descriptions

### cache/
- **processed-tasks.json** - Cache of ClickUp tasks already processed to prevent duplicates
- **processed-comments.json** - Cache of PR comment IDs already processed

### state/
- **task-queue.json** - Queue of pending and completed tasks
- **pipeline-state.json** - Execution pipeline state with stage tracking

### tracking/
- **pr-tracking.json** - Tracks PR creation and completion status
- **review-tracking.json** - Manages PR review cycles and iterations

## Setup

Copy example files from root to initialize:

```bash
# From project root
cp processed-tasks.json.example data/cache/processed-tasks.json
cp processed-comments.json.example data/cache/processed-comments.json
cp task-queue.json.example data/state/task-queue.json
cp pipeline-state.json.example data/state/pipeline-state.json
cp pr-tracking.json.example data/tracking/pr-tracking.json
cp review-tracking.json.example data/tracking/review-tracking.json
```

## Backup

To backup all state:

```bash
tar -czf timmy-backup-$(date +%Y%m%d).tar.gz data/
```

To restore:

```bash
tar -xzf timmy-backup-YYYYMMDD.tar.gz
```

## Reset

To reset all state (keeps directory structure):

```bash
cd data
rm -f cache/*.json state/*.json tracking/*.json
# Then copy .example files again
```
