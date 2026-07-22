#!/bin/bash
# PiCaster Kiosk Exit Script
# Called by the web app (POST /api/exit-kiosk) or via magic URL when kiosk is running.
# Attempts to restore the desktop gracefully; falls back to killing Chromium.
#
# Exit codes:
#   0 = success (Chromium terminated or desktop restored)
#   1 = no kiosk process found (nothing to do)
#   2 = not running as pi user / no desktop to return to

set -e

LOG_PREFIX="[exit-kiosk]"
PID_FILE="/tmp/pi-caster-kiosk.pid"

log() { echo "$LOG_PREFIX $(date): $*"; }

# --- Determine display ---
DISPLAY="${DISPLAY:-:0}"
export DISPLAY

# --- Option 1: use wmctl to exit fullscreen / restore window manager ---
exit_via_wmctl() {
    if command -v wmctl &> /dev/null; then
        log "Attempting wmctl exit..."
        # Try to switch to first available virtual desktop / unmapped state
        wmctl -i exit 2>/dev/null && { log "wmctl exit ok"; return 0; }
        # If wmctl exit isn't available (some WMs block it), try killing the window
        local CHROME_WIN
        CHROME_WIN=$(wmctl -l 2>/dev/null | grep -i "chromium\|kiosk\|pi-projector" | awk '{print $1}' | head -1 || true)
        if [[ -n "$CHROME_WIN" ]]; then
            log "Closing Chromium window: $CHROME_WIN"
            wmctl -i "$CHROME_WIN" close 2>/dev/null && { log "Window closed"; return 0; }
        fi
    fi
    return 1
}

# --- Option 2: pkill Chromium (last resort) ---
kill_chromium() {
    local CHROME_PIDS
    # Match Chromium processes in kiosk mode (exclude --type=gpu-process etc.)
    CHROME_PIDS=$(pgrep -f "chromium.*--kiosk\|chromium.*--incognito" 2>/dev/null | grep -v "^\$$" || true)
    if [[ -z "$CHROME_PIDS" ]]; then
        log "No kiosk Chromium process found."
        return 1
    fi
    log "Killing kiosk Chromium PIDs: $CHROME_PIDS"
    echo "$CHROME_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 1
    # Force kill if still alive
    local REMAINING
    REMAINING=$(pgrep -f "chromium.*--kiosk\|chromium.*--incognito" 2>/dev/null || true)
    if [[ -n "$REMAINING" ]]; then
        log "Force killing remaining PIDs: $REMAINING"
        echo "$REMAINING" | xargs kill -9 2>/dev/null || true
    fi
    log "Chromium killed."
    return 0
}

# --- Option 3: restart the display manager / return to login ---
return_to_desktop() {
    log "Attempting to return to desktop..."
    # On Raspberry Pi OS with LightDM:
    if systemctl is-active --quiet lightdm 2>/dev/null; then
        log "Switching to LightDM greeter..."
        sudo systemctl restart lightdm 2>/dev/null && { log "LightDM restarted"; return 0; }
    fi
    # Try logging out the current session
    log "Sending SIGTERM to kiosk user session..."
    return 1
}

# --- Main ---
log "Kiosk exit triggered."

exit_via_wmctl && { log "Done (wmctl)."; exit 0; }
kill_chromium && { log "Done (kill)."; exit 0; }
return_to_desktop && { log "Done (desktop)."; exit 0; }

log "No recovery method succeeded."
exit 2
