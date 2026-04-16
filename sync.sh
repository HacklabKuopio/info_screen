#!/bin/bash
# Pull latest playlist changes from git.
# Run this on a cron or systemd timer on your Ubuntu infoscreen machine.
# The Electron app hot-reloads playlist.json automatically.

cd "$(dirname "$0")"
git pull origin main
