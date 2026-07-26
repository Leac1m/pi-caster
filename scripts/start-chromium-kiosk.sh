#!/bin/bash
# start-chromium-kiosk.sh
# Waits for the AeroBeam server to be online before launching Chromium to prevent Connection Refused errors.

echo "Waiting for AeroBeam server to start..."

# Poll the local IP endpoint. -s is silent, -f fails on non-200.
while ! curl -s -f http://127.0.0.1:3000/api/ip > /dev/null; do
    sleep 1
done

echo "AeroBeam server is up! Launching Chromium..."
exec "$@"
