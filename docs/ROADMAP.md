# PiProjector Roadmap

Based on the Product Requirements Document (PRD) and current codebase status, this document tracks the phases of the PiProjector project.

## Phase 1: Core Setup & Infrastructure
- [x] Initialize Node.js project.
- [x] Set up Express server.
- [x] Configure Docker & Caddy for local HTTPS (Secure Context requirement for WebRTC/`getDisplayMedia`).

## Phase 2: WebRTC Signaling Server
- [x] Integrate Socket.IO.
- [x] Implement room/receiver registration logic.
- [x] Implement WebRTC signaling (Offer, Answer, ICE candidates exchange).

## Phase 3: Web Application (Frontend)
- [x] Build Sender UI (`sender.html`) to trigger `getDisplayMedia` and stream.
- [x] Build Receiver UI (`receiver.html`) to automatically handle incoming streams.
- [x] Implement core WebRTC peer connection logic on client-side.
- [x] Style interfaces with basic CSS.

## Phase 4: Raspberry Pi Integration (Hardware & OS)
- [ ] Implement QR Code generation on the Receiver UI to display the Pi's local IP address.
- [ ] Configure Raspberry Pi to automatically boot into Chromium Kiosk Mode.
- [ ] Create an auto-start service/script for the local server on the Pi.

## Phase 5: Refinement, Stability & Edge Cases
- [ ] Address mobile constraints (investigate alternatives or handle UI gracefully as mobile browsers technically restrict `getDisplayMedia`).
- [ ] Implement robust auto-reconnect logic on the Sender/Receiver.
- [ ] Test and optimize for low-latency (< 200ms) on a local network without external STUN/TURN servers.
- [ ] Refine user interface for "WOW" factor and premium experience.
