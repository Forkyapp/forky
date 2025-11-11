# Forky Project Context

## Overview

Forky is a task automation system that connects ClickUp with GitHub via AI agents.

## Architecture

- Multi-AI pipeline: Gemini → Claude → Codex
- File-based storage (JSON)
- Workspace-based project management

## Key Modules

- `lib/orchestrator.ts` - Main workflow
- `lib/workspace.ts` - Project management
- `lib/storage/` - Data persistence
- `lib/{model}.ts` - AI agent integrations

## Coding Conventions

- Use forky UI module for console output
- Repository pattern for all file operations
- TypeScript strict mode
- Custom error classes in `src/shared/errors/`

## Dependencies

- axios: API calls
- dotenv: Environment variables
- TypeScript: Type safety

## Recent Refactorings

- Moved to workspace system (Nov 2024)
- Organized data into `data/` directory
- Deprecated repos.json
