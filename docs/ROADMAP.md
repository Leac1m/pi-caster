# PiProjector Roadmap

Based on the Product Requirements Document (Full Presentation Suite) and current codebase status, this document tracks the phases of the PiProjector project.

## Phase 1: Core Setup & Infrastructure
- [x] Initialize Node.js project.
- [x] Set up Express server.
- [x] Configure Docker & Caddy for local HTTPS.

## Phase 2: WebRTC Signaling Server & WebSockets
- [x] Integrate Socket.IO.
- [x] Implement room/receiver registration logic.
- [x] Implement WebRTC signaling (Offer, Answer, ICE candidates).
- [x] Implement remote control WebSocket commands (Next, Previous, Stop).

## Phase 3: Web Application (Frontend)
- [x] Build Sender UI (`sender.html`) to trigger `getDisplayMedia` and stream.
- [x] Build Receiver UI (`receiver.html`) to automatically handle incoming streams.
- [x] Implement core WebRTC peer connection logic on client-side.
- [x] Design Mobile Dashboard with "Upload Presentation" and "Share Live Screen" options.
- [x] Implement Remote Control UI (clicker layout) for presentations.
- [x] Implement Document Rendering on Receiver UI (using `pptx-viewer`, `PDF.js`).

## Phase 4: Document Handling (Backend)
- [x] Implement HTTP multipart/form-data upload logic.
- [x] Add logic to securely purge temporary files after a session ends.

## Phase 5: Raspberry Pi Integration (Hardware & OS)
- [x] Implement QR Code generation on the Receiver UI to display the Pi's local IP address.
- [x] Configure Raspberry Pi to automatically boot into Chromium Kiosk Mode.
- [x] Create an auto-start service/script for the local server on the Pi.

## Phase 6: Refinement, Stability & Edge Cases
- [x] Address mobile constraints for screen share (e.g. restrict to Presentation Mode on mobile, use screen share on laptop).
- [x] Implement robust auto-reconnect logic on the Sender/Receiver.
- [x] Test and optimize for low-latency (< 200ms).
- [x] Refine user interface for "WOW" factor and premium experience.

## Phase 7: Network Provisioning (AP Fallback & Captive Portal)
- [x] Integrate a network manager tool (e.g., RaspAP or NetworkManager API) to allow the Pi to host its own Wi-Fi Hotspot.
- [x] Implement fallback logic: If no known Wi-Fi network is detected on boot, automatically launch the Hotspot.
- [x] Update Receiver UI to detect AP mode and display setup instructions ("Connect to Wi-Fi 'PiCaster-Setup'") instead of the standard IP QR code.
- [x] Build a Captive Portal web page served by the Node.js app to scan and display available local Wi-Fi networks.
- [x] Implement backend endpoint to receive Wi-Fi credentials from the captive portal, save them to the OS, and restart the networking service to connect to the new network.

## Phase 8: Advanced Document Handling (.pptx Support)
- [x] Research and integrate a client-side PowerPoint rendering library (e.g., `PPTXjs`) directly into the frontend.
- [x] Update the `index.html` file upload validation to natively accept `.pptx` files.
- [x] Implement canvas/DOM rendering for `.pptx` slides on both the Remote dashboard and the Projector receiver without needing a backend server conversion step.
