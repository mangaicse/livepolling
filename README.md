# ⚡ LivePoll — Real-Time Audience Voting Platform

> A live interactive polling application where creators build polls, audience members vote across devices, and live percentage breakdowns stream with zero page refresh.

---

## 🎯 Architecture & Real Use of the Stack

Each layer of the stack was chosen deliberately to handle specific high-concurrency challenges:

```
                  ┌────────────────────────────────────────┐
                  │          React Frontend (SPA)          │
                  │  - Presenter Projector Screen          │
                  │  - Touch-optimized Mobile Voter UI     │
                  │  - Live SVG & CSS Animated Bars        │
                  │  - Built-in QR Code Generator          │
                  └───────▲────────────────────────▲───────┘
                          │                        │
               REST APIs  │             WebSockets │ (Auto-reconnect)
                          ▼                        ▼
                  ┌────────────────────────────────────────┐
                  │           Go Backend (Gin)             │
                  │  - Gorilla WebSocket Hubs              │
                  │  - JWT Authentication Middleware       │
                  │  - Strict Server-side Input Validation │
                  │  - Goroutine-safe Concurrency          │
                  └───────┬────────────────────────┬───────┘
                          │                        │
       Durable Persistence│            Atomic State│ & Realtime Pub/Sub
                          ▼                        ▼
    ┌─────────────────────────────┐      ┌─────────────────────────────┐
    │          MongoDB            │      │            Redis            │
    │  - User Accounts (bcrypt)   │      │  - HINCRBY: Atomic tallies  │
    │  - Poll Schema & Options    │      │  - SADD: Voter dedup sets   │
    │  - Immutable Vote Audit Log │      │  - PUBLISH: Fanout events   │
    │  - Unique Indexes           │      │  - Live viewer counters     │
    └─────────────────────────────┘      └─────────────────────────────┘
```

### 1. Frontend: React + Vite
- **Zero-Refresh Realtime Sync**: Connected via WebSockets with automatic exponential-backoff reconnection.
- **Presenter & Projector View**: High-contrast, clean fullscreen view with live total vote tickers, active audience count, and live winning option badge.
- **Audience Experience**: Instant 6-digit access code joiner or mobile QR code scanner, single/multi-choice voting cards, and instant celebratory feedback (`canvas-confetti`).
- **Modern Glassmorphism UI**: Custom vanilla CSS design system featuring tailored dark palettes, micro-interactions, responsive flex/grid layouts, and zero heavy UI libraries.

### 2. Backend: Go (Gin Engine)
- **High Concurrency & Low Latency**: Compiled native Go binary utilizing lightweight goroutines for WebSocket connections.
- **Strict Server-Side Validation**:
  - Validates poll existence and closed status before accepting any vote.
  - Enforces single-choice vs multiple-choice constraints.
  - Validates all submitted option IDs against the poll's registered choices.
- **JWT Authentication**: Secure token generation and verification protecting poll creation and management routes.

### 3. Database: MongoDB
- **Durable Documents**: Stores user credentials, poll definitions, choice lists, and audit timestamps.
- **Audit & Analytics Trail**: Asynchronously logs every individual vote record (`_id`, `poll_id`, `voter_hash`, `ip_hash`, `timestamp`) for tamper-proof analytics.
- **Indexes**: Unique constraints on user emails and poll access codes.

### 4. Realtime Engine: Redis
Redis is actively driving the core real-time voting mechanics:
- **Atomic Counters (`HINCRBY`)**: Tallies votes directly in Redis hashes (`poll:<id>:counts`) to prevent race conditions during parallel traffic spikes.
- **Duplicate Prevention (`SADD`)**: Anonymously hashes device fingerprints with poll IDs into Redis sets (`poll:<id>:voters`). If `SADD` returns 0, the vote is rejected with HTTP `409 Conflict`.
- **Pub/Sub Fanout (`PUBLISH` / `SUBSCRIBE`)**: Emits `poll_events:<id>` events across nodes, triggering Go WebSocket hubs to broadcast live percentage updates to all connected viewers in sub-millisecond time.
- **Resilience**: Features built-in in-memory fallback emulation if external Redis/MongoDB instances are not immediately running locally.

---

## 🚀 Key Engineering Decisions

| Requirement | Decision | Why |
|---|---|---|
| **Realtime Updates** | WebSockets + Redis Pub/Sub | HTTP polling adds unnecessary load and latency; Redis Pub/Sub allows horizontal scaling across multiple backend instances. |
| **Duplicate Voting** | Redis `SADD` on hashed voter token | In-memory atomic check prevents multiple submissions from the same device without requiring audience login friction. |
| **Poll Access** | 6-Character Unique Alphanumeric Code + QR Code | High usability for live presentations where participants can type short codes or scan mobile QR codes. |
| **Production Bundle** | Single-Container Serving | Go can optionally serve the built static SPA directly, simplifying deployment to a single free-tier container without CORS overhead. |

---

## 🛠️ Project Layout

```
/livepoll
├── backend/
│   ├── cmd/server/main.go         # Server bootstrap, graceful shutdown & routes
│   ├── config/config.go           # Environment variables configuration
│   ├── controllers/               # Auth, Poll CRUD, and Voting controllers
│   ├── middleware/                # JWT auth and CORS middleware
│   ├── models/                    # MongoDB and Redis data models
│   ├── repository/                # MongoDB & Redis repositories with fallbacks
│   └── websocket/                 # Goroutine-safe Hub and Client pumps
├── frontend/
│   ├── src/
│   │   ├── components/            # Navbar, ResultBar, QRCodeModal, Toast
│   │   ├── context/               # AuthContext (JWT session management)
│   │   ├── hooks/                 # useLivePoll WebSocket hook
│   │   ├── pages/                 # Home, Login, Register, Dashboard, Create, Vote, Host
│   │   └── services/api.js        # Centralized REST API client
│   ├── index.html
│   └── vite.config.js
├── Dockerfile                     # Multi-stage production container
├── docker-compose.yml             # Complete local stack (Mongo + Redis + Go + React)
└── render.yaml                    # Automated cloud deployment blueprint
```

---

## 💻 Running Locally

### Option A: Complete Stack via Docker Compose (Recommended)
Make sure Docker is running on your machine:
```bash
docker compose up --build
```
- Open `http://localhost:8080` to use the application.

---

### Option B: Running Manually

#### 1. Backend (Go)
Make sure Go is installed (Go 1.22+):
```bash
cd backend
go run cmd/server/main.go
```
The backend will start at `http://localhost:8080`.
*(Note: If MongoDB or Redis are not running locally, the backend automatically logs a friendly message and activates its resilient in-memory engine, so you can test immediately without setup).*

#### 2. Frontend (React + Vite)
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing

Run the Go test suite to verify authentication, poll creation, duplicate vote prevention, input validation, and concurrent voting:
```bash
cd backend
go test -v ./...
```

---

## 🌐 Deploying to Live Cloud (Free Tier)

### 1. Free Cloud Databases
1. **MongoDB Atlas**: Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) $\to$ Copy connection string `mongodb+srv://...`.
2. **Upstash Redis**: Create a free serverless Redis database at [upstash.com](https://upstash.com) $\to$ Copy Redis URL and Password.

### 2. One-Click Deploy to Render / Railway / Fly.io
You can deploy using the included `Dockerfile` or `render.yaml`:
1. Push this repository to GitHub.
2. Link the repository to **Render** (New $\to$ Web Service $\to$ Docker).
3. Add Environment Variables:
   - `MONGO_URI`: Your MongoDB Atlas URI
   - `MONGO_DB_NAME`: `livepoll`
   - `REDIS_URI`: Your Upstash Redis endpoint (`rediss://...`)
   - `REDIS_PASSWORD`: Your Upstash password
   - `JWT_SECRET`: Any random 32-character string
   - `PORT`: `8080`
4. Click **Deploy**. Your live link will be live at `https://your-service.onrender.com`.
