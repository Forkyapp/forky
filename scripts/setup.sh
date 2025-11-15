#!/bin/bash

# Timmy Setup Script
# Copies template files to their working locations

set -e

echo "🔧 Setting up Timmy..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to copy template if destination doesn't exist
copy_if_not_exists() {
  local template=$1
  local destination=$2

  if [ -f "$destination" ]; then
    echo -e "${YELLOW}⏩${NC} Skipping $destination (already exists)"
  else
    mkdir -p "$(dirname "$destination")"
    cp "$template" "$destination"
    echo -e "${GREEN}✅${NC} Created $destination"
  fi
}

# Configuration files
echo "📋 Setting up configuration files..."
copy_if_not_exists "templates/.env" ".env"
copy_if_not_exists "templates/workspace.json" "workspace.json"
copy_if_not_exists "templates/projects.json" "projects.json"
echo ""

# Data directories
echo "💾 Setting up data storage..."
copy_if_not_exists "templates/data/cache/processed-tasks.json" "data/cache/processed-tasks.json"
copy_if_not_exists "templates/data/cache/processed-comments.json" "data/cache/processed-comments.json"
copy_if_not_exists "templates/data/state/task-queue.json" "data/state/task-queue.json"
copy_if_not_exists "templates/data/state/pipeline-state.json" "data/state/pipeline-state.json"
copy_if_not_exists "templates/data/tracking/pr-tracking.json" "data/tracking/pr-tracking.json"
copy_if_not_exists "templates/data/tracking/review-tracking.json" "data/tracking/review-tracking.json"
echo ""

# Context files
echo "📚 Setting up AI context templates..."
copy_if_not_exists "templates/.context/models/claude.md" ".context/models/claude.md"
copy_if_not_exists "templates/.context/models/gemini.md" ".context/models/gemini.md"
copy_if_not_exists "templates/.context/models/codex.md" ".context/models/codex.md"
copy_if_not_exists "templates/.context/shared/architecture.md" ".context/shared/architecture.md"
echo ""

# Create empty directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p progress
mkdir -p data/cache/embeddings
mkdir -p features
echo -e "${GREEN}✅${NC} Directories created"
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your API keys and credentials"
echo "2. Edit projects.json with your project configurations"
echo "3. Edit workspace.json to set your active project"
echo "4. Fill .context/models/*.md with your coding patterns"
echo "5. Run: npm install"
echo "6. Run: npm start"
echo ""
echo "For help, see: docs/PROJECT_MANAGEMENT.md"
