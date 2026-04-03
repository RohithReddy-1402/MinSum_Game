# Minimum Sum — Online Card Game

A real-time multiplayer card game built with **React + Tailwind CSS** (frontend) and **Node.js + Socket.io** (backend).

---

## Project Structure

```
minsum/
├── server/          ← Node.js + Socket.io backend
│   ├── index.js     ← Main server & socket handlers
│   ├── gameLogic.js ← All game rules (deck, validation, scoring)
│   └── package.json
└── client/          ← React + Tailwind frontend
    ├── src/
    │   ├── App.jsx
    │   ├── hooks/useSocket.js
    │   ├── utils/game.js
    │   └── components/
    │       ├── LobbyScreen.jsx
    │       ├── WaitingRoom.jsx
    │       ├── GameScreen.jsx
    │       ├── OtherPlayers.jsx
    │       ├── Card.jsx
    │       └── ShowResult.jsx
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Quick Start (Local)

### 1. Start the server

```bash
cd server
npm install
npm run dev        # uses nodemon for hot reload
# Server runs on http://localhost:3001
```

### 2. Start the client

```bash
cd client
npm install
npm run dev        # Vite dev server
# Client runs on http://localhost:5173
```

Open **multiple browser tabs** or different devices on the same network.
One player creates a room, others enter the 6-character code to join.

---

## Environment Variables

### Client — `client/.env`
```
VITE_SERVER_URL=http://localhost:3001
```
For production, set this to your deployed server URL, e.g.:
```
VITE_SERVER_URL=https://your-server.com
```

### Server — `server/.env` (optional)
```
PORT=3001
```

---

## How to Play

| Step | What to do |
|------|-----------|
| **Create** | One player creates a room, gets a 6-digit code |
| **Join** | Others enter the code to join (up to 6 players) |
| **Start** | Host clicks "Start Game" |
| **Your turn** | Pick 1 card from the pile OR draw from deck, then throw |
| **Throw** | Select ≥2 same-rank cards OR ≥3 consecutive cards |
| **Skip pick** | If throwing same rank + same count as previous player → no pick needed |
| **Show** | Call Show when you think your sum is lowest |
| **Penalty** | If your Show is wrong → you pay fixed penalty pts |
| **Win** | Last player under the elimination threshold wins |

### Card values
- **A** = 1, **2–9** = face value, **10 / J / Q / K** = 10
- **Joker** = 0 (no wildcard ability)
- Order: A 2 3 4 5 6 7 8 9 10 J Q K

---

## Deploying

### Server (e.g. Railway, Render, Fly.io)
```bash
cd server
npm install --production
node index.js
```

### Client (e.g. Vercel, Netlify)
```bash
cd client
echo "VITE_SERVER_URL=https://your-server-url.com" > .env
npm run build
# Upload the `dist/` folder
```

---

## Configuration (adjustable per room)

| Setting | Default | Description |
|---------|---------|-------------|
| Cards per player | 5 | How many cards dealt each round |
| Show penalty | 50 pts | Points paid for a fake Show |
| Elimination threshold | 210 pts | Score at which a player is knocked out |
