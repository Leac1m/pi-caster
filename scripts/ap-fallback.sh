#!/bin/bash
# PiCaster Access Point Fallback & Captive Portal Manager
# Runs on the host machine to manage NetworkManager

SHARED_DIR="$(dirname "$0")/.."
CREDS_FILE="$SHARED_DIR/wifi-credentials.json"
SCAN_FILE="$SHARED_DIR/wifi-scan-results.json"
AP_SSID="PiCaster-Setup"
AP_PASS="picaster"

echo "Starting AP Fallback Manager..."

# Ensure we're not currently in a hotspot mode from a previous crash
nmcli con down "$AP_SSID" 2>/dev/null

sleep 10 # Wait for normal connection attempt

# Check connection
if ! ping -c 1 8.8.8.8 &> /dev/null; then
    echo "No internet connection detected. Launching Hotspot..."
    nmcli device wifi hotspot ifname wlan0 ssid "$AP_SSID" password "$AP_PASS"
    HOTSPOT_ACTIVE=true
else
    echo "Connected to a known network."
    HOTSPOT_ACTIVE=false
fi

# Background task to periodically scan Wi-Fi networks and write to JSON for the Node app
scan_wifi() {
    while true; do
        if nmcli -t -f SSID dev wifi | grep -v '^$' > "$SHARED_DIR/wifi-raw.txt"; then
            # Convert simple text list to JSON array, removing duplicates
            jq -R -s -c 'split("\n") | map(select(length > 0)) | unique' < "$SHARED_DIR/wifi-raw.txt" > "$SCAN_FILE"
        fi
        sleep 15
    done
}
scan_wifi &
SCAN_PID=$!

# Watch for credentials file from the Node container
while true; do
    if [ -f "$CREDS_FILE" ]; then
        echo "Found new Wi-Fi credentials!"
        
        # Parse JSON
        SSID=$(jq -r '.ssid' "$CREDS_FILE")
        PASSWORD=$(jq -r '.password' "$CREDS_FILE")
        
        if [ "$HOTSPOT_ACTIVE" = true ]; then
            echo "Shutting down Hotspot..."
            nmcli con down "$AP_SSID"
            HOTSPOT_ACTIVE=false
        fi
        
        echo "Connecting to $SSID..."
        nmcli device wifi connect "$SSID" password "$PASSWORD"
        
        if [ $? -eq 0 ]; then
            echo "Successfully connected to $SSID"
            rm "$CREDS_FILE" # Clean up
            # Restart docker containers to ensure they pick up new network state
            cd "$SHARED_DIR" && docker-compose restart
        else
            echo "Failed to connect. Restarting Hotspot..."
            nmcli device wifi hotspot ifname wlan0 ssid "$AP_SSID" password "$AP_PASS"
            HOTSPOT_ACTIVE=true
            rm "$CREDS_FILE"
        fi
    fi
    sleep 2
done
