# Meetly – Real-Time Video Conferencing & Collaboration Tool

A secure multi-user meeting app built with **React, Node.js/Express, MongoDB, Socket.io and WebRTC**.

## Features
| Feature | How it works |
|---|---|
| Multi-user video calling | WebRTC peer-to-peer mesh (up to 6 people). Socket.io only relays signalling (offer/answer/ICE). |
| Screen sharing | `getDisplayMedia()` + `RTCRtpSender.replaceTrack()` swaps camera for screen without renegotiating. |
| File sharing | Upload to the server (max 25 MB), encrypted with AES-256-GCM on disk, download only by participants. |
| Whiteboard | Canvas with pen, text, eraser, colours, size. Strokes sync live over Socket.io; late joiners get the full drawing. Save as PNG. |
| Chat | Live messages, history stored **encrypted** in MongoDB. |
| Authentication | Register/login with bcrypt-hashed passwords and JWT; sockets also require a valid JWT. |

## Security & data encryption
- **Media in transit:** WebRTC audio/video is always encrypted with DTLS-SRTP.
- **Chat & files at rest:** AES-256-GCM (authenticated encryption) using `ENCRYPTION_KEY`.
- **Passwords:** bcrypt (cost 12). **Sessions:** JWT, 7 day expiry.
- **Access control:** a meeting code is random (~50 bits). Only users who joined can read chat history, list files or download files; sockets can only signal inside their own room.
- **Hardening:** Helmet headers, CORS restricted to the client URL, rate-limited auth routes, request size limits, input type checks (blocks NoSQL injection), validated whiteboard messages, blocked executable uploads, `nosniff` + forced download for files.
- **Production:** serve everything over **HTTPS/WSS** (browsers also require HTTPS for camera access except on `localhost`).

## Run locally
Requirements: Node 18+, MongoDB (local or Atlas).

```bash
# 1) Backend
cd server
npm install
cp .env.example .env
# generate a key and paste it into ENCRYPTION_KEY in .env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev            # http://localhost:5000

# 2) Frontend (new terminal)
cd client
npm install
npm run dev            # http://localhost:5173
```

### Try it
1. Register two accounts (use a normal window and an incognito window, or two browsers).
2. Create a meeting in one, copy the invite link, open it in the other.
3. Allow camera/microphone. Test screen share, whiteboard, chat and file sharing.

Testing across two different devices/networks needs HTTPS and usually a TURN server
(set `VITE_TURN_*` in `client/.env`, e.g. a free Metered/coturn server).

## Architecture
```
Browser A ──┐                              ┌── Browser B
            │  Socket.io (signalling,      │
            ├─ chat, whiteboard, notices) ─┤
            │         Express + Mongo      │
            └────────── WebRTC media (P2P, encrypted) ──────────┘
```

## Folder structure
```
server/  config/ models/ middleware/ routes/ utils/crypto.js socket.js server.js
client/  src/{hooks/useMeeting.js, components/, pages/, context/}
```

## REST API
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Auth |
| GET | `/api/auth/me` | Current user |
| POST / GET | `/api/rooms` | Create meeting / my meetings |
| POST | `/api/rooms/:code/join` | Join a meeting |
| GET | `/api/rooms/:code/messages` | Decrypted chat history |
| GET / POST | `/api/rooms/:code/files` | List / upload (encrypted) files |
| GET | `/api/files/:id/download` | Download (decrypted on the fly) |

## Socket events
`join-room`, `signal`, `peer-joined`, `peer-left`, `media-state`, `chat-message`, `file-shared`, `wb-op`, `wb-clear`

## Known limits
Mesh WebRTC suits small groups (≤6). For larger meetings, move to an SFU such as mediasoup or LiveKit.
