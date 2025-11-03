#!/bin/bash
      cd "/Users/user/Documents/Personal-Projects/collabifi-back"
      export PROMPT_FILE="/Users/user/Documents/Personal-Projects/clickup-claude-github/task-86evcknq0-codex-review-prompt.txt"

      # Unset GITHUB_TOKEN to let gh use keyring auth
      unset GITHUB_TOKEN
      unset GH_TOKEN

      # Launch Codex for review in fully autonomous mode
      (echo "y"; sleep 2; cat "$PROMPT_FILE") | codex --yolo --sandbox danger-full-access

      # Cleanup
      rm -f "$PROMPT_FILE"
      rm -f "/Users/user/Documents/Personal-Projects/clickup-claude-github/task-86evcknq0-codex-review.sh"
