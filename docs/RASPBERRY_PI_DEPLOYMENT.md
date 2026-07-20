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

## 6. Usage

Upon rebooting, your Raspberry Pi should automatically open Chromium in full-screen mode showing the "PiProjector is Ready" screen.

A **QR Code** will be generated and displayed on the screen. Anyone on the same Wi-Fi network can scan this QR code with their mobile device to instantly open the remote dashboard and begin uploading presentations or sharing their screen!

### Troubleshooting
- **Containers aren't starting**: Run `docker ps` to ensure the `app` and `proxy` containers are running. Check logs with `docker-compose logs`.
- **Browser doesn't auto-start**: If you are using a custom OS or desktop environment, you may need to manually add `chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito https://localhost/receiver.html` to your specific session autostart configuration.
- **Cannot scan QR Code**: Ensure your mobile device is connected to the exact same local network as the Raspberry Pi.
