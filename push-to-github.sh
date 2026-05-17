#!/bin/bash
# Push Remote Claude Code to GitHub
# Run this when you have internet access to github.com

set -e

echo "=== Push Remote Claude Code to GitHub ==="
echo ""

# Check gh auth
if ! gh auth status &>/dev/null; then
  echo "Logging in to GitHub..."
  gh auth login --hostname github.com --git-protocol https
fi

# Create repo if not exists
if ! gh repo view ZaraSheven/remote-claude-code &>/dev/null; then
  echo "Creating repository..."
  gh repo create ZaraSheven/remote-claude-code \
    --public \
    --description "Remote Claude Code: web terminal to access Claude Code from Android over LAN" \
    --source . \
    --remote origin \
    --push
else
  echo "Repository exists, pushing..."
  git push -u origin master
fi

echo ""
echo "Done! Visit: https://github.com/ZaraSheven/remote-claude-code"
