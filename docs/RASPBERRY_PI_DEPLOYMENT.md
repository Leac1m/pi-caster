# PiCaster - Raspberry Pi Deployment Guide

This guide walks you through deploying PiCaster on a Raspberry Pi. Once configured, the Pi will automatically boot into Chromium Kiosk Mode, display the Receiver interface (along with a scannable QR code), and handle all screen-casting and presentation duties autonomously.

## Requirements
- **Hardware**: Raspberry Pi 4 or 5 is recommended for optimal WebRTC video streaming performance.
- **OS**: Raspberry Pi OS (with Desktop environment). PiCaster relies on the desktop environment (Wayfire or LXDE) to launch the Chromium browser.
- **Network**: None required! PiCaster acts as its own standalone Wi-Fi router.

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
4. **Standalone Network Setup**: Installs and configures `hostapd` and `dnsmasq` so the Pi automatically broadcasts the `PiCaster` Wi-Fi network and intercepts Captive Portal requests.
5. **Kiosk Mode Config**: Detects whether your Pi is using Wayland (Wayfire) or X11 (LXDE) and writes the appropriate configuration to launch `chromium-browser` in full-screen incognito mode pointing to `https://localhost/receiver`.

## 2. Reboot

Once the script finishes, simply reboot your Raspberry Pi:
```bash
sudo reboot
```

## 3. Usage (Plug-and-Play)

PiCaster operates as a completely standalone, plug-and-play appliance. You do not need to connect it to the internet or a local building Wi-Fi network.

1. **Power On**: Plug in the Raspberry Pi. It will automatically broadcast a Wi-Fi network named **`PiCaster`**.
2. **Projector Screen**: Once booted, the projector screen will display a large QR code.
3. **Connect**: Open your phone or laptop's camera and scan the QR code. Your device will automatically join the `PiCaster` Wi-Fi network.
4. **Captive Portal**: Once connected, your operating system will automatically pop up a "Captive Portal" window (similar to hotel or airport Wi-Fi). Instead of a login screen, this popup serves the **PiCaster Sender Dashboard** directly!
5. **Present**: You can instantly use your phone as a remote control. To share your full laptop screen, follow the on-screen instructions to open Safari or Chrome and navigate to `picaster.local`.

### Troubleshooting
- **Containers aren't starting**: Run `docker ps` to ensure the `app` and `proxy` containers are running. Check logs with `docker-compose logs`.
- **Browser doesn't auto-start**: If you are using a custom OS or desktop environment, you may need to manually add `chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito https://localhost/receiver` to your specific session autostart configuration.
- **Cannot scan QR Code**: Ensure your mobile device is connected to the exact same local network as the Raspberry Pi.
- **Hotspot isn't showing up**: Ensure `NetworkManager` is installed on the OS and managing your `wlan0` interface.
