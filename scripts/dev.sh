#!/bin/bash
# PiCaster Dev Mode — for easy iteration without full kiosk/hotspot setup
# Usage: bash scripts/dev.sh
#
# What this does (on your laptop or Pi):
#   - Runs the Node server directly (no Docker, no Caddy, no hostapd)
#   - No captive portal redirect
#   - No HTTPS (plain HTTP only)
#   - Receiver accessible at http://localhost:3000/receiver
#
# On a Pi connected to your router (not as hotspot):
#   - Phone connects to same Wi-Fi router as the Pi
#   - Phone browser hits http://<pi-ip>:3000
#
# On your laptop (no Pi needed):
#   - http://localhost:3000

set -e

PORT="${PORT:-3000}"

echo "Starting PiCaster in dev mode on port $PORT..."
echo ""
echo "URLs (dev mode, no HTTPS, no captive portal):"
echo "  Dashboard : http://localhost:$PORT/"
echo "  Receiver : http://localhost:$PORT/receiver"
echo "  Sender   : http://localhost:$PORT/sender"
echo "  Remote   : http://localhost:$PORT/remote"
echo ""
echo "Press Ctrl+C to stop."

cd "$(dirname "$0")/.."
exec node server.js
