#!/bin/bash
# PiCaster Raspberry Pi Setup Script
# This script configures a Raspberry Pi to boot into Chromium Kiosk Mode and ensures the server auto-starts.

echo "Starting PiCaster Raspberry Pi Setup..."

# 1. Ensure Docker is enabled on boot (since docker-compose restart: unless-stopped is configured)
echo "Enabling Docker service on boot..."
sudo systemctl enable docker
sudo systemctl start docker

# Start the docker containers
echo "Starting PiCaster docker containers..."
if command -v docker-compose &> /dev/null; then
    sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
else
    sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
fi

# 1.5 Setup AP Fallback Service
echo "Installing dependencies and setting up AP Fallback service..."
sudo apt-get update && sudo apt-get install -y jq network-manager
sudo cp scripts/ap-fallback.sh /usr/local/bin/picaster-ap-fallback
sudo chmod +x /usr/local/bin/picaster-ap-fallback

cat <<EOF | sudo tee /etc/systemd/system/picaster-ap.service
[Unit]
Description=PiCaster AP Fallback Manager
After=network.target docker.service

[Service]
ExecStart=/usr/local/bin/picaster-ap-fallback
Restart=always
User=root
WorkingDirectory=$(pwd)

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable picaster-ap.service
sudo systemctl start picaster-ap.service

# 2. Configure Chromium Kiosk Mode
echo "Configuring Chromium Kiosk Mode..."

# Check if using Wayland (newer Pi OS) or X11 (older Pi OS)
if [ -d "$HOME/.config/wayfire" ] || [ -f "$HOME/.config/wayfire.ini" ]; then
    echo "Wayland (Wayfire) detected."
    mkdir -p $HOME/.config
    WAYFIRE_INI="$HOME/.config/wayfire.ini"
    
    if ! grep -q "chromium-browser" "$WAYFIRE_INI" 2>/dev/null; then
        echo -e "\n[autostart]\nchromium = chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito https://localhost/receiver" >> "$WAYFIRE_INI"
        echo "Added Chromium to Wayfire autostart."
    else
        echo "Chromium autostart already configured in Wayfire."
    fi

elif [ -d "$HOME/.config/lxsession/LXDE-pi" ]; then
    echo "X11 (LXDE) detected."
    AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"
    
    if ! grep -q "chromium-browser" "$AUTOSTART" 2>/dev/null; then
        echo "@xset s off" >> "$AUTOSTART"
        echo "@xset -dpms" >> "$AUTOSTART"
        echo "@xset s noblank" >> "$AUTOSTART"
        echo "@chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito https://localhost/receiver" >> "$AUTOSTART"
        echo "Added Chromium to LXDE autostart."
    else
        echo "Chromium autostart already configured in LXDE."
    fi
else
    echo "Warning: Could not detect Wayfire or LXDE configuration directories."
    echo "Please manually configure your desktop environment to auto-start Chromium:"
    echo "chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito https://localhost/receiver"
fi

echo "Setup complete! Please restart your Raspberry Pi to verify the kiosk mode."
