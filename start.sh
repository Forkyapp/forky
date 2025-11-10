#!/bin/bash

# Unset any system environment variables that might override .env file
unset CLICKUP_WORKSPACE_ID
unset CLICKUP_API_KEY
unset CLICKUP_SECRET
unset CLICKUP_BOT_USER_ID
unset GITHUB_OWNER
unset GITHUB_REPO
unset GITHUB_BASE_BRANCH
unset GITHUB_REPO_PATH
unset GITHUB_TOKEN
unset GITHUB_DEFAULT_USERNAME

# Start the bot
node forky.js
