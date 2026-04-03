import { useState, useEffect, useCallback } from "react";
import { useSocket } from "./hooks/useSocket";
import LobbyScreen from "./components/LobbyScreen";
import WaitingRoom from "./components/WaitingRoom";
import GameScreen from "./components/GameScreen";

// Persist session so refresh doesn't lose your seat
const SESSION_KEY = "minsum_session";
function saveSession(data) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export default function App() {
  const { connected, emit, on } = useSocket();
  const [screen, setScreen] = useState("lobby"); // lobby | waiting | game
  const [room, setRoom] = useState(null);
  const [myId, setMyId] = useState(null);
  const [myCode, setMyCode] = useState(null);
  const [toast, setToast] = useState("");

  // Show a temporary toast message
  const showToast = useCallback((msg, duration = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(""), duration);
  }, []);

  // ── Listen for room updates from server ──────────────────────────────────────
  useEffect(() => {
    const off = on("room:update", (updatedRoom) => {
      setRoom(updatedRoom);

      // Route to correct screen based on room status
      if (updatedRoom.status === "playing" || updatedRoom.status === "finished") {
        setScreen("game");
      } else if (updatedRoom.status === "lobby") {
        setScreen("waiting");
      }

      // Detect disconnected players and show toast
      const me = updatedRoom.players.find(p => p.id === myId);
      if (me && !me.connected) {
        showToast("You appear disconnected — reconnecting…");
      }
    });
    return off;
  }, [on, myId, showToast]);

  // ── Try to rejoin on reconnect / page refresh ────────────────────────────────
  useEffect(() => {
    if (!connected) return;
    const session = loadSession();
    if (!session) return;

    emit("room:rejoin", { code: session.code, playerId: session.playerId })
      .then(res => {
        if (res?.ok) {
          setMyId(session.playerId);
          setMyCode(session.code);
          showToast("Reconnected to room!");
        } else {
          clearSession();
        }
      });
  }, [connected]); // eslint-disable-line

  // ── Create room ──────────────────────────────────────────────────────────────
  async function handleCreateRoom(name, config) {
    const res = await emit("room:create", { name, config });
    if (!res?.ok) throw new Error(res?.error || "Failed to create room");
    setMyId(res.playerId);
    setMyCode(res.code);
    saveSession({ code: res.code, playerId: res.playerId });
    setScreen("waiting");
  }

  // ── Join room ────────────────────────────────────────────────────────────────
  async function handleJoinRoom(name, code) {
    const res = await emit("room:join", { name, code });
    if (!res?.ok) throw new Error(res?.error || "Room not found or full");
    setMyId(res.playerId);
    setMyCode(res.code);
    saveSession({ code: res.code, playerId: res.playerId });
    setScreen("waiting");
  }

  // ── Config change (host only) ────────────────────────────────────────────────
  function handleConfigChange(config) {
    emit("room:config", { code: myCode, playerId: myId, config });
  }

  // ── Start game ───────────────────────────────────────────────────────────────
  async function handleStartGame() {
    const res = await emit("game:start", { code: myCode, playerId: myId });
    if (!res?.ok) showToast(res?.error || "Cannot start game");
  }

  // ── Generic game action emitter ──────────────────────────────────────────────
  const handleAction = useCallback(async (event, data) => {
    const res = await emit(event, { code: myCode, playerId: myId, ...data });
    return res;
  }, [emit, myCode, myId]);

  // ── Next round (host) ────────────────────────────────────────────────────────
  async function handleNextRound() {
    const res = await emit("game:next_round", { code: myCode, playerId: myId });
    if (!res?.ok) showToast(res?.error || "Cannot start next round");
  }

  // ── Leave / new game ─────────────────────────────────────────────────────────
  function handleNewGame() {
    clearSession();
    setRoom(null);
    setMyId(null);
    setMyCode(null);
    setScreen("lobby");
  }

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 100, background: "rgba(20,40,20,0.95)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12, padding: "10px 20px",
          color: "#f0ead8", fontSize: 13, fontWeight: 500,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          animation: "floatUp 0.3s ease-out both",
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      {screen === "lobby" && (
        <LobbyScreen
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          connected={connected}
        />
      )}

      {screen === "waiting" && room && (
        <WaitingRoom
          room={room}
          myId={myId}
          onStartGame={handleStartGame}
          onConfigChange={handleConfigChange}
        />
      )}

      {screen === "game" && room && (
        <GameScreen
          room={room}
          myId={myId}
          onAction={handleAction}
          onNextRound={handleNextRound}
          onNewGame={handleNewGame}
        />
      )}
    </div>
  );
}
