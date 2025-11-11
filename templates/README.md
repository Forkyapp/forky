# Templates Directory

This directory contains template files that are copied to your working directory during setup.

## Why Templates Instead of .example Files?

Instead of tracking `.example` files that users need to manually copy and rename, we use a cleaner approach:

1. **Clean naming**: Files have their actual names (e.g., `workspace.json` instead of `workspace.json.example`)
2. **Easy setup**: Run `npm run setup` to copy all templates at once
3. **No renaming needed**: Templates are copied with the correct names automatically
4. **Better organization**: All templates are in one place

## Template Structure

```
templates/
├── .env                              # Environment variables template
├── workspace.json                    # Active project pointer
├── projects.json                     # All project configurations
├── .context/                         # AI context templates
│   ├── models/
│   │   ├── claude.md                # Claude coding patterns
│   │   ├── gemini.md                # Gemini documentation style
│   │   └── codex.md                 # Codex review checklist
│   └── shared/
│       └── architecture.md          # Shared architecture patterns
└── data/                            # Data storage templates
    ├── cache/
    ├── state/
    └── tracking/
```

## Usage

### First Time Setup

```bash
# Run setup script
npm run setup

# This will:
# 1. Copy all templates to working locations
# 2. Skip files that already exist
# 3. Create necessary directories
```

### Manual Setup (if needed)

```bash
# Copy specific template
cp templates/.env .env
cp templates/workspace.json workspace.json
cp templates/projects.json projects.json

# Copy context templates
cp templates/.context/models/claude.md .context/models/claude.md
```

## What Gets Tracked in Git?

**Tracked (in templates/):**
- All template files
- This README

**Not Tracked (in working directory):**
- `.env` - Contains your API keys
- `workspace.json` - Your active project
- `projects.json` - Your project configurations
- `.context/models/*.md` - Your coding patterns
- `data/**/*.json` - Runtime data

## After Setup

1. **Edit .env** with your API keys and credentials
2. **Edit projects.json** with your project configurations
3. **Edit workspace.json** to set your active project
4. **Fill .context/models/*.md** with your coding patterns and guidelines
5. Run `npm start`

## See Also

- [Project Management Guide](../docs/PROJECT_MANAGEMENT.md)
- [Context System Guide](../docs/CONTEXT_SYSTEM.md)
- [Integration Guide](../docs/INTEGRATION_COMPLETE.md)
