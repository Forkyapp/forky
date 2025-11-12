# Templates Directory

This directory contains template data files for the Forky data storage system.

## Template Structure

```
templates/
└── data/                            # Data storage templates
    ├── cache/
    │   ├── processed-tasks.json     # Task cache template
    │   └── processed-comments.json  # Comment cache template
    ├── state/
    │   ├── task-queue.json          # Task queue template
    │   └── pipeline-state.json      # Pipeline state template
    └── tracking/
        ├── pr-tracking.json         # PR tracking template
        └── review-tracking.json     # Review tracking template
```

## Usage

### First Time Setup

Use the interactive setup script to configure Forky:

```bash
npm run init
```

This will guide you through:
1. GitHub authentication
2. ClickUp API configuration
3. Project setup
4. System settings

See [QUICKSTART.md](../QUICKSTART.md) for detailed setup instructions.

## What Gets Tracked in Git?

**Tracked (in templates/):**
- Empty data template files
- This README

**Not Tracked (in working directory):**
- `.env` - Contains your API keys
- `workspace.json` - Your active project
- `projects.json` - Your project configurations
- `data/**/*.json` - Runtime data

## See Also

- [Quick Start Guide](../QUICKSTART.md)
- [Full Documentation](../README.md)
- [Contributing Guide](../CONTRIBUTING.md)
