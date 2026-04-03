const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const {
  validateThrow, matchesPrevious,
  getNextActiveIndex, dealRound, resolveShow,
  handSum,
} = require("./gameLogic");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── In-memory store ──────────────────────────────────────────────────────────
// rooms[roomCode] = { code, hostId, config, players, gameState, status }
const rooms = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function sanitizeRoomForClient(room, requestingSocketId) {
  if (!room) return null;
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    config: room.config,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      eliminated: p.eliminated,
      connected: p.connected,
      cardCount: p.hand ? p.hand.length : 0,
      // Only send own hand
      hand: p.id === requestingSocketId ? p.hand : undefined,
    })),
    gameState: room.gameState
      ? {
          currentIdx: room.gameState.currentIdx,
          phase: room.gameState.phase,
          prevThrown: room.gameState.prevThrown,
          openingCard: room.gameState.openingCard,
          deckCount: room.gameState.deck ? room.gameState.deck.length : 0,
          log: room.gameState.log,
          showResult: room.gameState.showResult,
          roundNum: room.gameState.roundNum,
        }
      : null,
  };
}

function broadcastRoom(room) {
  room.players.forEach(p => {
    if (p.connected && p.socketId) {
      io.to(p.socketId).emit("room:update", sanitizeRoomForClient(room, p.id));
    }
  });
}

function findRoomBySocket(socketId) {
  return Object.values(rooms).find(r =>
    r.players.some(p => p.socketId === socketId)
  );
}

// ─── Socket handlers ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Create room ─────────────────────────────────────────────────────────────
  socket.on("room:create", ({ name, config }, cb) => {
    let code = genRoomCode();
    while (rooms[code]) code = genRoomCode();

    const playerId = uuidv4();
    const room = {
      code,
      hostId: playerId,
      status: "lobby",    // lobby | playing | finished
      config: {
        cardsEach: config?.cardsEach ?? 5,
        showPenalty: config?.showPenalty ?? 50,
        penaltyLimit: config?.penaltyLimit ?? 210,
      },
      players: [
        {
          id: playerId,
          socketId: socket.id,
          name: name || "Host",
          score: 0,
          eliminated: false,
          connected: true,
          hand: [],
        },
      ],
      gameState: null,
    };

    rooms[code] = room;
    socket.join(code);
    console.log(`[room:create] ${code} by ${name}`);
    cb({ ok: true, code, playerId });
    broadcastRoom(room);
  });

  // ── Join room ───────────────────────────────────────────────────────────────
  socket.on("room:join", ({ code, name }, cb) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) return cb({ ok: false, error: "Room not found" });
    if (room.status === "playing") return cb({ ok: false, error: "Game already in progress" });
    if (room.players.length >= 6) return cb({ ok: false, error: "Room is full (max 6 players)" });

    const playerId = uuidv4();
    room.players.push({
      id: playerId,
      socketId: socket.id,
      name: name || `Player ${room.players.length + 1}`,
      score: 0,
      eliminated: false,
      connected: true,
      hand: [],
    });

    socket.join(code.toUpperCase());
    console.log(`[room:join] ${name} joined ${code}`);
    cb({ ok: true, code: code.toUpperCase(), playerId });
    broadcastRoom(room);
  });

  // ── Rejoin (on reconnect) ───────────────────────────────────────────────────
  socket.on("room:rejoin", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ ok: false, error: "Room not found" });
    const player = room.players.find(p => p.id === playerId);
    if (!player) return cb({ ok: false, error: "Player not found in room" });

    player.socketId = socket.id;
    player.connected = true;
    socket.join(code);
    console.log(`[room:rejoin] ${player.name} rejoined ${code}`);
    cb({ ok: true });
    broadcastRoom(room);
  });

  // ── Update config (host only) ───────────────────────────────────────────────
  socket.on("room:config", ({ code, playerId, config }) => {
    const room = rooms[code];
    if (!room || room.hostId !== playerId) return;
    room.config = { ...room.config, ...config };
    broadcastRoom(room);
  });

  // ── Start game (host only) ──────────────────────────────────────────────────
  socket.on("game:start", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    if (room.hostId !== playerId) return cb?.({ ok: false, error: "Only host can start" });
    if (room.players.length < 2) return cb?.({ ok: false, error: "Need at least 2 players" });
    if (room.status === "playing") return cb?.({ ok: false, error: "Already started" });

    const { players, openingCard, deck } = dealRound(room.players, room.config.cardsEach);
    room.players = players;
    room.status = "playing";
    room.gameState = {
      currentIdx: 0,
      phase: "pick",       // pick | throw
      prevThrown: [],
      openingCard,
      deck,
      log: [`Game started! ${room.players[0].name} goes first.`],
      showResult: null,
      roundNum: 1,
    };

    console.log(`[game:start] ${code}`);
    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── Pick from pile ──────────────────────────────────────────────────────────
  socket.on("game:pick_pile", ({ code, playerId, cardId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "pick") return cb?.({ ok: false, error: "Not in pick phase" });

    const card = gs.prevThrown.find(c => c.id === cardId);
    if (!card) return cb?.({ ok: false, error: "Card not found in pile" });

    const player = room.players[playerIdx];
    player.hand = [...player.hand, card];
    gs.prevThrown = gs.prevThrown.filter(c => c.id !== cardId);
    gs.phase = "throw";
    gs.log.push(`${player.name} picked ${card.rank}${card.suit} from pile`);

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── Draw from stack ─────────────────────────────────────────────────────────
  socket.on("game:draw_stack", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "pick") return cb?.({ ok: false, error: "Not in pick phase" });
    if (!gs.deck || gs.deck.length === 0) return cb?.({ ok: false, error: "Stack is empty" });

    const drawn = gs.deck[0];
    gs.deck = gs.deck.slice(1);
    const player = room.players[playerIdx];
    player.hand = [...player.hand, drawn];
    gs.phase = "throw";
    gs.log.push(`${player.name} drew from stack`);

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── Throw cards ─────────────────────────────────────────────────────────────
  socket.on("game:throw", ({ code, playerId, cardIds }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "throw") return cb?.({ ok: false, error: "Must pick a card first" });

    const player = room.players[playerIdx];
    const throwing = player.hand.filter(c => cardIds.includes(c.id));
    if (throwing.length !== cardIds.length) return cb?.({ ok: false, error: "Invalid card selection" });

    // No-pick check: if same rank + count as previous, player could have skipped pick
    // but they already went through throw phase — that's fine, just validate the set
    const v = validateThrow(throwing);
    if (!v.valid) return cb?.({ ok: false, error: v.reason });

    // Remove from hand
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));
    gs.prevThrown = throwing;
    gs.phase = "pick";

    const label = throwing.map(c => c.isJoker ? "JKR" : `${c.rank}${c.suit}`).join(" ");
    gs.log.push(`${player.name} threw: ${label}`);

    // Advance to next active player
    gs.currentIdx = getNextActiveIndex(room.players, playerIdx);

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── Skip pick (same rank + count as previous throw) ─────────────────────────
  socket.on("game:skip_pick", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "pick") return cb?.({ ok: false, error: "Not in pick phase" });

    // The client should have already validated matchesPrevious — but we trust server to set phase
    gs.phase = "throw";
    const player = room.players[playerIdx];
    gs.log.push(`${player.name} skipped pick (same set as previous)`);

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── Call Show ───────────────────────────────────────────────────────────────
  socket.on("game:show", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });

    const { players: updatedPlayers, fakeShow, callerIdx, callerSum, handSums } = resolveShow(
      room.players,
      playerIdx,
      room.config
    );
    room.players = updatedPlayers;

    const callerName = room.players[callerIdx].name;
    let resultMsg;
    if (fakeShow) {
      resultMsg = `Fake show by ${callerName}! ${callerName} pays ${room.config.showPenalty} penalty points.`;
    } else {
      resultMsg = `${callerName} wins the round with sum ${callerSum}! Others pay their hand sum.`;
    }

    gs.showResult = {
      fakeShow,
      callerIdx,
      callerName,
      callerSum,
      resultMsg,
      players: room.players.map((p, i) => ({
        name: p.name,
        id: p.id,
        hand: p.hand,
        sum: handSums[i],
        score: p.score,
        eliminated: p.eliminated,
        penaltyGiven: fakeShow
          ? i === callerIdx
          : !p.eliminated && i !== callerIdx,
      })),
    };

    gs.phase = "show_result";
    gs.log.push(resultMsg);

    // Check if game over
    const activePlayers = room.players.filter(p => !p.eliminated);
    if (activePlayers.length <= 1) {
      room.status = "finished";
      gs.winner = activePlayers[0]?.name || "Nobody";
    }

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── Next round ──────────────────────────────────────────────────────────────
  socket.on("game:next_round", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });
    if (room.hostId !== playerId) return cb?.({ ok: false, error: "Only host can start next round" });
    if (room.status === "finished") return cb?.({ ok: false, error: "Game is over" });

    const { players, openingCard, deck } = dealRound(room.players, room.config.cardsEach);
    room.players = players;

    const firstActive = room.players.findIndex(p => !p.eliminated);
    room.gameState = {
      currentIdx: firstActive >= 0 ? firstActive : 0,
      phase: "pick",
      prevThrown: [],
      openingCard,
      deck,
      log: [...room.gameState.log, `--- Round ${room.gameState.roundNum + 1} ---`, `${room.players[firstActive >= 0 ? firstActive : 0].name} goes first.`],
      showResult: null,
      roundNum: room.gameState.roundNum + 1,
    };

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      player.connected = false;
      console.log(`[disconnect] ${player.name} from ${room.code}`);
      broadcastRoom(room);
    }
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ ok: true, rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ MinSum server running on :${PORT}`));
