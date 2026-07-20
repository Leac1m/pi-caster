# 📽️ PiCaster

**PiCaster** is a smart, standalone casting and presentation system designed for Raspberry Pi. It transforms any dumb projector or screen into a wireless, modern presentation hub.

Instead of fumbling with HDMI cables, presenters simply scan a QR code on the screen, upload a PDF presentation from their mobile device, and use their phone as a fully-featured, synchronized remote control—complete with local slide previews and presenter controls.

---

## ✨ Features

- 📱 **Zero-Install Mobile Remote**: Presenters scan a QR code to instantly turn their phone into a synchronized clicker.
- 📄 **Live PDF & PPTX Previews**: The mobile remote securely renders the active slide locally using native client-side rendering (PDF.js and PPTXjs), keeping the presenter perfectly in sync.
- 🔄 **State Resiliency**: Accidentally refreshed your browser? Dropped Wi-Fi? PiCaster tracks your active slide state and perfectly recovers on both the projector and the remote instantly.
- 🛜 **Smart Captive Portal (Fallback AP)**: If the Raspberry Pi can't find a known Wi-Fi network, it automatically spins up its own "PiCaster-Setup" Wi-Fi hotspot. Connect to it to select the room's Wi-Fi, type the password, and let it seamlessly transition.
- 🔒 **Auto-HTTPS**: Fully automated local HTTPS powered by Caddy, ensuring secure WebRTC and camera/screen permissions.
- 🐳 **Dockerized**: The entire application and its proxy run inside optimized Docker containers.
- ✅ **Tested**: Includes an automated Playwright End-to-End test suite to ensure slide synchronization and upload flows are rock solid.

---

## 🚀 Quick Start (Raspberry Pi)

PiCaster comes with a fully automated, one-click installer designed for fresh Raspberry Pi OS installations.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Leac1m/pi-caster.git
   cd pi-caster
   ```

2. **Run the automated setup script:**
   ```bash
   bash scripts/setup-pi.sh
   ```

3. **Reboot:**
   ```bash
   sudo reboot
   ```

### What does the setup script do?
- Installs all missing dependencies (`docker`, `chromium-browser`).
- Spins up the application via `docker-compose`.
- Installs the Wi-Fi AP fallback service (`NetworkManager`).
- Configures Chromium to launch automatically in full-screen Kiosk mode on boot.

*(For detailed hardware deployment notes, see [RASPBERRY_PI_DEPLOYMENT.md](docs/RASPBERRY_PI_DEPLOYMENT.md))*

---

## 💻 Development Setup (Host Machine)

If you want to contribute or test the UI locally without a Raspberry Pi:

1. **Ensure you have Docker and Docker Compose installed.**
2. **Start the local dev environment:**
   ```bash
   docker-compose up --build
   ```
3. **Access the Application:**
   * **Receiver (Projector View):** `http://localhost:3000/receiver`
   * **Sender (Upload/Remote View):** `http://localhost:3000/index`

---

## 🧪 Running Tests

PiCaster uses **Playwright** for complete End-to-End browser testing.

To run the suite locally:
```bash
npm install
PORT=3005 npx playwright test
```
*Note: We dynamically pass a custom `PORT` to prevent conflicts if your local dev server is currently running.*

---

## 🏗️ Architecture

- **Backend:** Node.js, Express, Socket.io
- **Frontend:** HTML5, Vanilla JS, CSS Flexbox/Grid
- **Document Rendering:** PDF.js
- **Reverse Proxy / SSL:** Caddy
- **System Integration:** Bash, NetworkManager (`nmcli`), Systemd

### File Structure
* `/public/` - Static HTML/CSS/JS frontend files (`receiver.html`, `remote.html`, `index.html`)
* `/server.js` - Main Node.js signaling, upload, and state management server
* `/scripts/` - Automated setup and AP-fallback bash scripts
* `/tests/e2e/` - Playwright browser automation tests
* `/docs/` - Detailed architectural and deployment documentation

---

## 🛣️ Roadmap
For upcoming features (including WebRTC native screen mirroring), check out the [ROADMAP.md](docs/ROADMAP.md).
