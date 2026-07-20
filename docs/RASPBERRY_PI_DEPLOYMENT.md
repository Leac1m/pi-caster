# PiCaster - Raspberry Pi Deployment Guide

This guide walks you through deploying PiCaster on a Raspberry Pi. Once configured, the Pi will automatically boot into Chromium Kiosk Mode, display the Receiver interface (along with a scannable QR code), and handle all screen-casting and presentation duties autonomously.

## Requirements
- **Hardware**: Raspberry Pi 4 or 5 is recommended for optimal WebRTC video streaming performance.
- **OS**: Raspberry Pi OS (with Desktop environment). PiCaster relies on the desktop environment (Wayfire or LXDE) to launch the Chromium browser.
- **Network**: The Pi must be connected to the local Wi-Fi network or Ethernet.

## 1. Initial Setup

First, open a terminal on your Raspberry Pi and ensure your system is up to date:
```bash
sudo apt update && sudo apt upgrade -y
```

Install Git:
```bash
sudo apt install git -y
```

## 2. Install Docker & Docker Compose

PiCaster uses Docker to manage the Express server and the Caddy HTTPS proxy.

Install Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Add your user to the Docker group so you can run commands without `sudo`:
```bash
sudo usermod -aG docker $USER
```
*(Note: You may need to log out and log back in, or run `newgrp docker`, for this to take effect.)*

Install Docker Compose:
```bash
sudo apt-get install docker-compose-plugin -y
# Or for older versions: sudo apt-get install docker-compose -y
```

## 3. Clone the Repository

Clone the PiCaster repository into your home directory (or another preferred location):
```bash
cd ~
git clone <your-repository-url> pi-caster
cd pi-caster
```

## 4. Run the Automated Setup Script

We have provided an automated script that configures your Raspberry Pi's desktop environment to automatically boot into Chromium Kiosk Mode, and ensures the Docker containers start on boot.

From the `pi-caster` directory, run:
```bash
chmod +x scripts/setup-pi.sh
./scripts/setup-pi.sh
```

**What the script does:**
1. **Docker Service**: Enables and starts the Docker systemd service.
2. **Container Spin-up**: Runs `docker-compose up -d` to build and start the PiCaster containers.
3. **Kiosk Mode Config**: Detects whether your Pi is using Wayland (Wayfire) or X11 (LXDE) and writes the appropriate configuration to launch `chromium-browser` in full-screen incognito mode pointing to `https://localhost/receiver.html`.

## 5. Reboot

Once the script finishes, reboot your Raspberry Pi:
```bash
sudo reboot
```

## 6. Usage & Wi-Fi Provisioning (Captive Portal)

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
- **Browser doesn't auto-start**: If you are using a custom OS or desktop environment, you may need to manually add `chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito https://localhost/receiver.html` to your specific session autostart configuration.
- **Cannot scan QR Code**: Ensure your mobile device is connected to the exact same local network as the Raspberry Pi.
- **Hotspot isn't showing up**: Ensure `NetworkManager` is installed on the OS and managing your `wlan0` interface.
