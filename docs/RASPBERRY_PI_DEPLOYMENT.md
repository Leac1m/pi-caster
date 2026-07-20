# PiCaster - Raspberry Pi Deployment Guide

This guide walks you through deploying PiCaster on a Raspberry Pi. Once configured, the Pi will automatically boot into Chromium Kiosk Mode, display the Receiver interface (along with a scannable QR code), and handle all screen-casting and presentation duties autonomously.

## Requirements
- **Hardware**: Raspberry Pi 4 or 5 is recommended for optimal WebRTC video streaming performance.
- **OS**: Raspberry Pi OS (with Desktop environment). PiCaster relies on the desktop environment (Wayfire or LXDE) to launch the Chromium browser.
- **Network**: The Pi must be connected to the local Wi-Fi network or Ethernet.

## 1. Quick Start Installation

Because PiCaster is designed as a standalone appliance, we have created an automated installation script that handles all dependencies, container builds, and desktop configurations.

First, open a terminal on your fresh Raspberry Pi OS installation and clone the repository:
```bash
git clone https://github.com/Leac1m/pi-caster.git
cd pi-caster
```

Then, run the automated setup script:
```bash
bash scripts/setup-pi.sh
```

**What the script does under the hood:**
1. **Installs Dependencies**: Automatically installs Docker, Docker Compose, Chromium, and NetworkManager if they are missing.
2. **Docker Service**: Enables and starts the Docker systemd service.
3. **Container Spin-up**: Runs `docker-compose up -d` to build and start the PiCaster containers (Node.js and Caddy).
4. **Networking Fallback**: Installs the `picaster-ap-fallback` systemd service to manage the Captive Portal hotspot.
5. **Kiosk Mode Config**: Detects whether your Pi is using Wayland (Wayfire) or X11 (LXDE) and writes the appropriate configuration to launch `chromium-browser` in full-screen incognito mode pointing to `https://localhost/receiver`.

## 2. Reboot

Once the script finishes, simply reboot your Raspberry Pi:
```bash
sudo reboot
```

## 3. Usage & Wi-Fi Provisioning (Captive Portal)

PiCaster includes a smart Network Provisioning system for easy deployment in new environments.

### Normal Operation
If the Raspberry Pi detects a known Wi-Fi network (or is plugged into Ethernet), it will connect automatically. 
Upon booting, Chromium will open and display the "PiProjector is Ready" screen with a **QR Code**. Anyone on the same network can scan this QR code to instantly open the remote dashboard and begin sharing.

### Captive Portal (Setup Mode)
If you move the Raspberry Pi to a new room/building where it does not know the Wi-Fi credentials:
1. After 10 seconds of failing to reach the internet, the Pi will automatically host its own temporary Wi-Fi Hotspot named **`PiCaster-Setup`** (Password: `picaster`).
2. The projector screen will detect this and hide the QR code, instead displaying instructions to connect to this setup network.
3. Connect your phone or laptop to `PiCaster-Setup` and navigate to `http://10.42.0.1`.
4. You will see the **PiCaster Setup** page. Select the room's Wi-Fi network from the dropdown, enter the password, and hit Connect.
5. The Pi will securely save these credentials, disable its hotspot, and connect to the room's Wi-Fi. The screen will automatically refresh with the standard QR code.

### Troubleshooting
- **Containers aren't starting**: Run `docker ps` to ensure the `app` and `proxy` containers are running. Check logs with `docker-compose logs`.
- **Browser doesn't auto-start**: If you are using a custom OS or desktop environment, you may need to manually add `chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito https://localhost/receiver` to your specific session autostart configuration.
- **Cannot scan QR Code**: Ensure your mobile device is connected to the exact same local network as the Raspberry Pi.
- **Hotspot isn't showing up**: Ensure `NetworkManager` is installed on the OS and managing your `wlan0` interface.
