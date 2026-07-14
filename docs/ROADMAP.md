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
- [ ] Implement QR Code generation on the Receiver UI to display the Pi's local IP address.
- [ ] Configure Raspberry Pi to automatically boot into Chromium Kiosk Mode.
- [ ] Create an auto-start service/script for the local server on the Pi.

## Phase 6: Refinement, Stability & Edge Cases
- [ ] Address mobile constraints for screen share (e.g. restrict to Presentation Mode on mobile, use screen share on laptop).
- [ ] Implement robust auto-reconnect logic on the Sender/Receiver.
- [ ] Test and optimize for low-latency (< 200ms).
- [ ] Refine user interface for "WOW" factor and premium experience.
