#!/bin/bash
# PiCaster Raspberry Pi Setup Script
# This script configures a Raspberry Pi to boot into Chromium Kiosk Mode and ensures the server auto-starts.
# Use --dev to skip kiosk/hotspot and run the server directly for easy iteration.

DEV_MODE=false
for arg in "$@"; do
    if [[ "$arg" == "--dev" || "$arg" == "-d" ]]; then
        DEV_MODE=true
    fi
done

if [[ "$DEV_MODE" == "true" ]]; then
    echo "=== DEV MODE ==="
    echo "Running server directly (no Docker, no kiosk, no hotspot)."
    echo ""
    echo "On this Pi (screen + keyboard):"
    echo "  http://localhost:3000"
    echo ""
    echo "From another device on the same network:"
    echo "  http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "Press Ctrl+C to stop."
    cd "$(dirname "$0")/.." && exec node server.js
    exit $?
fi

echo "Starting PiCaster Raspberry Pi Setup..."

# 0. Install Prerequisites
echo "Checking and installing prerequisites..."
sudo apt-get update

# Find correct Chromium command (varies between Pi OS versions)
if command -v chromium-browser &> /dev/null; then
    CHROMIUM_CMD="chromium-browser"
elif command -v chromium &> /dev/null; then
    CHROMIUM_CMD="chromium"
else
    echo "Installing Chromium Browser..."
    sudo apt-get install -y chromium-browser
    if command -v chromium-browser &> /dev/null; then
        CHROMIUM_CMD="chromium-browser"
    else
        CHROMIUM_CMD="chromium"
    fi
fi

if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "Docker installed. You may need to log out and log back in for user group changes to take effect."
fi

# 1. Ensure Docker is enabled on boot (since docker-compose restart: unless-stopped is configured)
echo "Enabling Docker service on boot..."
sudo systemctl enable docker
sudo systemctl start docker

# Start the docker containers
echo "Starting PiCaster docker containers..."
if command -v docker-compose &> /dev/null; then
    sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
else
    sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
fi

# 1.5 Setup Standalone Access Point (Phase 9)
echo "Installing hostapd and dnsmasq..."
sudo apt-get update && sudo apt-get install -y hostapd dnsmasq network-manager

# Stop services before configuration
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq

echo "Telling NetworkManager to ignore wlan0..."
sudo mkdir -p /etc/NetworkManager/conf.d
cat <<EOF | sudo tee /etc/NetworkManager/conf.d/99-unmanaged-devices.conf
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF
sudo systemctl restart NetworkManager

echo "Configuring static IP for wlan0 via systemd-networkd..."
cat <<EOF | sudo tee /etc/systemd/network/10-wlan0.network
[Match]
Name=wlan0

[Network]
Address=10.42.0.1/24
DHCPServer=no
EOF
sudo systemctl enable systemd-networkd
sudo systemctl restart systemd-networkd

echo "Configuring dnsmasq for DHCP and Captive Portal DNS spoofing..."
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig 2>/dev/null || true
cat <<EOF | sudo tee /etc/dnsmasq.conf
interface=wlan0
dhcp-range=10.42.0.10,10.42.0.100,255.255.255.0,24h
# Wildcard DNS to trigger captive portal
address=/#/10.42.0.1
EOF

echo "Configuring hostapd..."
cat <<EOF | sudo tee /etc/hostapd/hostapd.conf
interface=wlan0
driver=nl80211
ssid=PiCaster
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=picaster2026
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF

cat <<EOF | sudo tee /etc/default/hostapd
DAEMON_CONF="/etc/hostapd/hostapd.conf"
EOF

sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
sudo systemctl start hostapd
sudo systemctl start dnsmasq

# Cleanup legacy AP fallback if exists
if [ -f "/etc/systemd/system/picaster-ap.service" ]; then
    echo "Removing legacy AP Fallback service..."
    sudo systemctl stop picaster-ap.service
    sudo systemctl disable picaster-ap.service
    sudo rm /etc/systemd/system/picaster-ap.service
    sudo rm /usr/local/bin/picaster-ap-fallback
    sudo systemctl daemon-reload
fi

# 2. Configure Chromium Kiosk Mode
echo "Configuring Chromium Kiosk Mode..."

# Generate a unique kiosk exit token for this installation
KIOSK_EXIT_TOKEN="$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p)"
echo "KIOSK_EXIT_TOKEN=$KIOSK_EXIT_TOKEN" | sudo tee /etc/pi-caster-env > /dev/null
echo "Generated kiosk exit token (saved to /etc/pi-caster-env)."

# Build Chromium flags with kiosk escape support
KIOSK_FLAGS="--kiosk --noerrdialogs --disable-infobars --incognito"
KIOSK_FLAGS="$KIOSK_FLAGS --ozone-platform=wayland"
KIOSK_FLAGS="$KIOSK_FLAGS --kiosk-escape-key=Escape"
KIOSK_FLAGS="$KIOSK_FLAGS --kiosk-shortcut-action=openUrl"

# Check if using Wayland (newer Pi OS) or X11 (older Pi OS)
if command -v labwc &> /dev/null || [ -d "$HOME/.config/labwc" ]; then
    echo "Wayland (labwc) detected."
    mkdir -p "$HOME/.config/labwc"
    LABWC_AUTOSTART="$HOME/.config/labwc/autostart"

    if ! grep -q "$CHROMIUM_CMD" "$LABWC_AUTOSTART" 2>/dev/null; then
        echo "source /etc/pi-caster-env; KIOSK_EXIT_TOKEN=\$KIOSK_EXIT_TOKEN $CHROMIUM_CMD $KIOSK_FLAGS https://localhost/receiver &" >> "$LABWC_AUTOSTART"
        echo "Added Chromium to labwc autostart."
    else
        echo "Chromium autostart already configured in labwc."
    fi

elif command -v wayfire &> /dev/null || [ -f "/etc/wayfire/wayfire.ini" ]; then
    echo "Wayland (Wayfire) detected."
    mkdir -p "$HOME/.config"
    WAYFIRE_INI="$HOME/.config/wayfire.ini"

    if ! grep -q "$CHROMIUM_CMD" "$WAYFIRE_INI" 2>/dev/null; then
        echo -e "\n[autostart]" >> "$WAYFIRE_INI"
        echo "chromium = bash -c 'source /etc/pi-caster-env; KIOSK_EXIT_TOKEN=\$KIOSK_EXIT_TOKEN $CHROMIUM_CMD $KIOSK_FLAGS https://localhost/receiver'" >> "$WAYFIRE_INI"
        echo "Added Chromium to Wayfire autostart."
    else
        echo "Chromium autostart already configured in Wayfire."
    fi

elif command -v startlxde-pi &> /dev/null || command -v lxsession &> /dev/null; then
    echo "X11 (LXDE) detected."
    mkdir -p "$HOME/.config/lxsession/LXDE-pi"
    AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"

    if ! grep -q "$CHROMIUM_CMD" "$AUTOSTART" 2>/dev/null; then
        echo "@xset s off" >> "$AUTOSTART"
        echo "@xset -dpms" >> "$AUTOSTART"
        echo "@xset s noblank" >> "$AUTOSTART"
        echo "@bash -c 'source /etc/pi-caster-env && KIOSK_EXIT_TOKEN=\$KIOSK_EXIT_TOKEN $CHROMIUM_CMD $KIOSK_FLAGS https://localhost/receiver'" >> "$AUTOSTART"
        echo "Added Chromium to LXDE autostart."
    else
        echo "Chromium autostart already configured in LXDE."
    fi
else
    echo "Warning: Could not detect Wayfire or LXDE configuration directories."
    echo "Please manually configure your desktop environment to auto-start Chromium:"
    echo "KIOSK_EXIT_TOKEN=$KIOSK_EXIT_TOKEN $CHROMIUM_CMD $KIOSK_FLAGS https://localhost/receiver"
fi

echo "Setup complete! Please restart your Raspberry Pi to verify the kiosk mode."
