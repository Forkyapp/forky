#!/bin/bash

# Forky Setup Script
# Copies template files to their working locations

set -e

echo "🔧 Setting up Forky..."
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

# Data directories
echo "💾 Setting up data storage..."
copy_if_not_exists "templates/data/cache/processed-tasks.json" "data/cache/processed-tasks.json"
copy_if_not_exists "templates/data/cache/processed-comments.json" "data/cache/processed-comments.json"
copy_if_not_exists "templates/data/state/task-queue.json" "data/state/task-queue.json"
copy_if_not_exists "templates/data/state/pipeline-state.json" "data/state/pipeline-state.json"
copy_if_not_exists "templates/data/tracking/pr-tracking.json" "data/tracking/pr-tracking.json"
copy_if_not_exists "templates/data/tracking/review-tracking.json" "data/tracking/review-tracking.json"
echo ""

# Create empty directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p progress
mkdir -p data/cache/embeddings
mkdir -p features
echo -e "${GREEN}✅${NC} Directories created"
echo ""

echo "✨ Data storage setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm run init (for interactive setup)"
echo "2. Or configure manually:"
echo "   - Create .env with your API keys"
echo "   - Create projects.json with your projects"
echo "   - Create workspace.json to set active project"
echo "3. Run: npm install"
echo "4. Run: npm start"
echo ""
echo "For detailed setup instructions, see: QUICKSTART.md"
