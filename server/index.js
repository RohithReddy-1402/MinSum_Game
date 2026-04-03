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

const rooms = {};

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function sanitizeRoomForClient(room, requestingPlayerId) {
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
      hand: p.id === requestingPlayerId ? p.hand : undefined,
    })),
    gameState: room.gameState ? {
      currentIdx: room.gameState.currentIdx,
      phase: room.gameState.phase,
      prevThrown: room.gameState.prevThrown,
      pickablePile: room.gameState.pickablePile,
      deckCount: room.gameState.deck ? room.gameState.deck.length : 0,
      log: room.gameState.log,
      showResult: room.gameState.showResult,
      roundNum: room.gameState.roundNum,
      lastThrownBy: room.gameState.lastThrownBy,
    } : null,
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
  return Object.values(rooms).find(r => r.players.some(p => p.socketId === socketId));
}

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on("room:create", ({ name, config }, cb) => {
    let code = genRoomCode();
    while (rooms[code]) code = genRoomCode();

    const playerId = uuidv4();
    const room = {
      code,
      hostId: playerId,
      status: "lobby",
      config: {
        cardsEach: config?.cardsEach ?? 5,
        showPenalty: config?.showPenalty ?? 50,
        penaltyLimit: config?.penaltyLimit ?? 210,
      },
      players: [{
        id: playerId, socketId: socket.id,
        name: name || "Host", score: 0,
        eliminated: false, connected: true, hand: [],
      }],
      gameState: null,
    };

    rooms[code] = room;
    socket.join(code);
    console.log(`[room:create] ${code} by ${name}`);
    cb({ ok: true, code, playerId });
    broadcastRoom(room);
  });

  socket.on("room:join", ({ code, name }, cb) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) return cb({ ok: false, error: "Room not found" });
    if (room.status === "playing") return cb({ ok: false, error: "Game already in progress" });
    if (room.players.length >= 6) return cb({ ok: false, error: "Room is full (max 6 players)" });

    const playerId = uuidv4();
    room.players.push({
      id: playerId, socketId: socket.id,
      name: name || `Player ${room.players.length + 1}`,
      score: 0, eliminated: false, connected: true, hand: [],
    });

    socket.join(code.toUpperCase());
    console.log(`[room:join] ${name} joined ${code}`);
    cb({ ok: true, code: code.toUpperCase(), playerId });
    broadcastRoom(room);
  });

  socket.on("room:rejoin", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ ok: false, error: "Room not found" });
    const player = room.players.find(p => p.id === playerId);
    if (!player) return cb({ ok: false, error: "Player not found" });

    player.socketId = socket.id;
    player.connected = true;
    socket.join(code);
    console.log(`[room:rejoin] ${player.name} rejoined ${code}`);
    cb({ ok: true });
    broadcastRoom(room);
  });

  socket.on("room:config", ({ code, playerId, config }) => {
    const room = rooms[code];
    if (!room || room.hostId !== playerId) return;
    room.config = { ...room.config, ...config };
    broadcastRoom(room);
  });

  socket.on("game:start", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    if (room.hostId !== playerId) return cb?.({ ok: false, error: "Only host can start" });
    if (room.players.length < 2) return cb?.({ ok: false, error: "Need at least 2 players" });
    if (room.status === "playing") return cb?.({ ok: false, error: "Already started" });

    const { players, openingCard, deck } = dealRound(room.players, room.config.cardsEach);
    room.players = players;
    room.status = "playing";

    // Opening card placed on the table as the starting pile.
    // First player starts in "throw" phase — throw first, then pick if needed.
    room.gameState = {
      currentIdx: 0,
      phase: "throw",
      prevThrown: [openingCard],  // Opening card is on the pile — anyone can pick it after throwing
      pickablePile: null,         // Set during pick phase = prev player's thrown cards
      deck,
      log: [
        `Game started! Opening card: ${openingCard.rank}${openingCard.suit} is on the table.`,
        `${room.players[0].name} goes first — select cards and throw!`,
      ],
      showResult: null,
      roundNum: 1,
      lastThrownBy: null,
    };

    console.log(`[game:start] ${code}`);
    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── THROW CARDS — always the FIRST action each turn ────────────────────────
  // Flow after throw:
  //   same rank + same count as prevThrown → no pick needed, next player's turn
  //   different → phase = "pick", player picks 1 card (from pickablePile or stack)
  socket.on("game:throw", ({ code, playerId, cardIds }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "throw") return cb?.({ ok: false, error: "You must throw cards first this turn" });

    const player = room.players[playerIdx];
    const throwing = player.hand.filter(c => cardIds.includes(c.id));
    if (throwing.length !== cardIds.length) return cb?.({ ok: false, error: "Invalid card selection" });

    const v = validateThrow(throwing);
    if (!v.valid) return cb?.({ ok: false, error: v.reason });

    // Remove thrown cards from hand
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));

    const label = throwing.map(c => c.isJoker ? "JKR★" : `${c.rank}${c.suit}`).join(" ");

    // The current pile (prevThrown) is what the player can pick from if needed
    const pileBeforeThrow = gs.prevThrown;

    // Check if thrown cards match the current pile (same rank + same count) → no pick
    const noPickNeeded = matchesPrevious(throwing, pileBeforeThrow);

    // New pile is now what was just thrown
    gs.prevThrown = throwing;
    gs.lastThrownBy = playerIdx;

    if (noPickNeeded) {
      // Turn ends — no pick required
      gs.log.push(`${player.name} threw: ${label} ✓ Same set — no pick needed!`);
      gs.currentIdx = getNextActiveIndex(room.players, playerIdx);
      gs.phase = "throw";
      gs.pickablePile = null;
      gs.log.push(`${room.players[gs.currentIdx].name}'s turn!`);
    } else {
      // Player must now pick 1 card from the OLD pile OR draw from stack
      gs.phase = "pick";
      gs.pickablePile = pileBeforeThrow;  // These are what can be picked
      gs.log.push(`${player.name} threw: ${label} — pick 1 card from the old pile or draw from stack`);
    }

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── PICK FROM PILE — after throwing, pick 1 card from previous pile ─────────
  socket.on("game:pick_pile", ({ code, playerId, cardId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "pick") return cb?.({ ok: false, error: "You need to throw cards first before picking" });

    const pickable = gs.pickablePile || [];
    const card = pickable.find(c => c.id === cardId);
    if (!card) return cb?.({ ok: false, error: "That card is not available to pick" });

    const player = room.players[playerIdx];
    player.hand = [...player.hand, card];

    const pickedLabel = card.isJoker ? "JKR★" : `${card.rank}${card.suit}`;
    gs.log.push(`${player.name} picked ${pickedLabel} from the pile`);

    // End turn — advance to next player
    gs.currentIdx = getNextActiveIndex(room.players, playerIdx);
    gs.phase = "throw";
    gs.pickablePile = null;
    gs.log.push(`${room.players[gs.currentIdx].name}'s turn!`);

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── DRAW FROM STACK — after throwing, draw top card from deck ──────────────
  socket.on("game:draw_stack", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "pick") return cb?.({ ok: false, error: "You need to throw cards first before drawing" });
    if (!gs.deck || gs.deck.length === 0) return cb?.({ ok: false, error: "The stack is empty!" });

    const drawn = gs.deck[0];
    gs.deck = gs.deck.slice(1);
    const player = room.players[playerIdx];
    player.hand = [...player.hand, drawn];

    gs.log.push(`${player.name} drew from the stack`);

    // End turn — advance to next player
    gs.currentIdx = getNextActiveIndex(room.players, playerIdx);
    gs.phase = "throw";
    gs.pickablePile = null;
    gs.log.push(`${room.players[gs.currentIdx].name}'s turn!`);

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  // ── CALL SHOW — only at the start of your turn (throw phase) ──────────────
  socket.on("game:show", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });

    const gs = room.gameState;
    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== gs.currentIdx) return cb?.({ ok: false, error: "Not your turn" });
    if (gs.phase !== "throw") return cb?.({ ok: false, error: "You can only call Show at the start of your turn, before throwing" });

    const { players: updatedPlayers, fakeShow, callerIdx, callerSum, handSums } = resolveShow(
      room.players, playerIdx, room.config
    );
    room.players = updatedPlayers;

    const callerName = room.players[callerIdx].name;
    const resultMsg = fakeShow
      ? `Fake show by ${callerName}! Pays ${room.config.showPenalty} penalty pts.`
      : `${callerName} wins with sum ${callerSum}! Others pay their hand sum.`;

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
          : (!p.eliminated && i !== callerIdx),
        penaltyPoints: fakeShow
          ? (i === callerIdx ? room.config.showPenalty : 0)
          : (i !== callerIdx ? handSums[i] : 0),
      })),
    };

    gs.phase = "show_result";
    gs.log.push(resultMsg);

    const activePlayers = room.players.filter(p => !p.eliminated);
    if (activePlayers.length <= 1) {
      room.status = "finished";
      gs.winner = activePlayers[0]?.name || "Nobody";
    }

    cb?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("game:next_round", ({ code, playerId }, cb) => {
    const room = rooms[code];
    if (!room || !room.gameState) return cb?.({ ok: false, error: "No active game" });
    if (room.hostId !== playerId) return cb?.({ ok: false, error: "Only host can start next round" });
    if (room.status === "finished") return cb?.({ ok: false, error: "Game is over" });

    const { players, openingCard, deck } = dealRound(room.players, room.config.cardsEach);
    room.players = players;

    const firstActive = room.players.findIndex(p => !p.eliminated);
    const firstIdx = firstActive >= 0 ? firstActive : 0;

    room.gameState = {
      currentIdx: firstIdx,
      phase: "throw",
      prevThrown: [openingCard],
      pickablePile: null,
      deck,
      log: [
        ...room.gameState.log,
        `─── Round ${room.gameState.roundNum + 1} ───`,
        `Opening card: ${openingCard.rank}${openingCard.suit} on the table.`,
        `${room.players[firstIdx].name} goes first!`,
      ],
      showResult: null,
      roundNum: room.gameState.roundNum + 1,
      lastThrownBy: null,
    };

    cb?.({ ok: true });
    broadcastRoom(room);
  });

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

app.get("/health", (req, res) => res.json({ ok: true, rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ MinSum server running on :${PORT}`));
