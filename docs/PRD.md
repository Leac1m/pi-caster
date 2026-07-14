# Product Requirements Document: PiProjector (Full Presentation Suite)

## Overview
This document outlines the comprehensive PiProjector ecosystem. It combines local document hosting, native slide rendering, smartphone remote control, and live screen sharing into a single, unified web application operating over local peer-to-peer web technologies without requiring internet access.

## Target Audience
- Presenters, educators, or individuals in meeting rooms needing a seamless, hardware-agnostic way to cast their screens or control presentations on a projector without HDMI cables or dongles.

## 1. Feature Specifications

| Feature | Primary Function | Technical Approach |
| --- | --- | --- |
| **Document Upload** | Allows users to send presentation files to the Pi. | HTTP multipart/form-data upload to a local Node.js server. |
| **Native Parsing** | Displays slides without backend conversion. | Client-side JavaScript libraries (e.g., `pptx-viewer`, `PDF.js`) rendering in the Kiosk browser. |
| **Remote Control** | Turns the user's phone into a clicker. | Sub-millisecond WebSocket (`Socket.io`) commands sent from the phone to the Kiosk browser. |
| **Live Screen Share** | Mirrors the user's device for live demos. | WebRTC peer-to-peer streaming initialized via the native `getDisplayMedia()` API. |

## 2. Unified User Flow

The interface intelligently separates static presentations from live screen mirroring.

1. **Connection:** The user scans the projected QR code and joins the captive portal, loading the mobile dashboard.
2. **Mode Selection:** The user is presented with two primary actions: "Upload Presentation" or "Share Live Screen."
   * **Path A (Presentation):** The user uploads a `.pptx` or `.pdf` file. The file is sent to the Pi and rendered on the projector. The mobile UI switches to a Remote Control layout (Next/Previous buttons).
   * **Path B (Screen Share):** The user taps "Share Live Screen." Because transient user activation is required, this explicit tap safely triggers the OS permission prompt.
3. **Active State:** If Path B is chosen, the projector dynamically injects an HTML `<video>` element into the DOM, displaying the incoming `MediaStream`. The mobile UI switches to a "Stop Sharing" kill-switch.
4. **Session Termination:** Once the presentation is over or the user taps "Stop," the Kiosk browser resets to the Idle QR Code state. The system securely purges any temporary files from the Pi's local storage.

## 3. Technical Architecture & Constraints
### 3.1 Media Capture
* **Capture Mechanism:** The system utilizes the `navigator.mediaDevices.getDisplayMedia()` API to capture the screen.
* **Security & Context Requirements:** The `getDisplayMedia()` API is restricted to secure contexts (HTTPS). The local Node.js server must use a self-signed SSL certificate via Caddy.

### 3.2 Transmission & Networking
* **WebRTC:** Transmission directly to the Kiosk browser via local WebRTC P2P connection, brokered by Socket.IO.
* **WebSockets:** Used for real-time remote control signaling.

## 4. Success Metrics
* **Time to First Frame:** Target < 5 seconds for screen share.
* **Latency:** End-to-end delay < 200ms.
* **Reliability:** Successful connection without dropped frames or WebRTC negotiation failures.
