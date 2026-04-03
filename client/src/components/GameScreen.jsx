import { useState, useCallback } from "react";
import { CardFace, CardBack, CardBackStack } from "./Card";
import OtherPlayers from "./OtherPlayers";
import ShowResult from "./ShowResult";
import { validateThrow, matchesPrevious, handSum } from "../utils/game";

export default function GameScreen({ room, myId, onAction, onNextRound, onNewGame }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState("");
  const [showScores, setShowScores] = useState(false);

  const gs = room.gameState;
  const myPlayer = room.players.find(p => p.id === myId);
  const myIdx = room.players.findIndex(p => p.id === myId);
  const isMyTurn = gs && gs.currentIdx === myIdx;
  const currentPlayer = gs && room.players[gs.currentIdx];
  const myHand = myPlayer?.hand || [];
  const selectedCards = myHand.filter(c => selectedIds.includes(c.id));
  const isHost = room.hostId === myId;

  const setErr = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 3000);
  }, []);

  function toggleSelect(card) {
    if (!isMyTurn || gs.phase !== "throw") return;
    setSelectedIds(prev =>
      prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
    );
  }

  async function pickFromPile(card) {
    if (!isMyTurn || gs.phase !== "pick") return;
    const res = await onAction("game:pick_pile", { cardId: card.id });
    if (!res?.ok) setErr(res?.error || "Failed to pick");
    setSelectedIds([]);
  }

  async function drawFromStack() {
    if (!isMyTurn || gs.phase !== "pick") return;
    const res = await onAction("game:draw_stack", {});
    if (!res?.ok) setErr(res?.error || "Stack empty");
    setSelectedIds([]);
  }

  async function skipPick() {
    if (!isMyTurn) return;
    const res = await onAction("game:skip_pick", {});
    if (!res?.ok) setErr(res?.error || "Cannot skip pick");
  }

  async function confirmThrow() {
    if (selectedCards.length === 0) return setErr("Select cards to throw");
    const v = validateThrow(selectedCards);
    if (!v.valid) return setErr(v.reason);
    const res = await onAction("game:throw", { cardIds: selectedIds });
    if (!res?.ok) setErr(res?.error || "Invalid throw");
    else setSelectedIds([]);
  }

  async function callShow() {
    const res = await onAction("game:show", {});
    if (!res?.ok) setErr(res?.error || "Cannot call show now");
  }

  const canSkipPick = isMyTurn && gs?.phase === "pick" && matchesPrevious(selectedCards, gs?.prevThrown);
  const mySum = handSum(myHand);

  // Show result overlay
  if (gs?.phase === "show_result" && gs?.showResult) {
    return (
      <ShowResult
        result={{ ...gs.showResult, gameOver: room.status === "finished" }}
        isHost={isHost}
        onNextRound={onNextRound}
        onNewGame={onNewGame}
        config={room.config}
      />
    );
  }

  // Game over
  if (room.status === "finished" && gs?.winner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="panel p-8 text-center max-w-sm w-full animate-float">
          <div style={{ fontSize: 56, marginBottom: 12 }}>🏆</div>
          <h1 className="font-display text-3xl font-bold text-gold-400 mb-2">{gs.winner} wins!</h1>
          <p className="text-green-200/60 text-sm mb-6">Game over — all others eliminated</p>
          <div className="space-y-2 mb-6">
            {room.players.map((p, i) => (
              <div key={i} className="flex justify-between text-sm px-3 py-2 rounded-lg bg-white/5">
                <span className={p.eliminated ? "text-red-400 line-through" : "text-green-200"}>{p.name}</span>
                <span className="text-green-300/70">{p.score} pts</span>
              </div>
            ))}
          </div>
          <button onClick={onNewGame} className="btn-gold w-full py-3 rounded-xl text-sm font-semibold">
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-3 pb-6 max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge text-xs px-3 py-1.5 rounded-full font-semibold ${
            isMyTurn
              ? "bg-gold-500/20 text-gold-400 border border-gold-500/40"
              : "bg-white/10 text-green-200/70 border border-white/10"
          }`}>
            {isMyTurn ? "Your turn" : `${currentPlayer?.name ?? "?"}'s turn`}
          </span>
          <span className="badge bg-white/5 text-green-300/60 border border-white/10 text-xs px-2 py-1">
            Deck: {gs?.deckCount ?? "?"}
          </span>
          <span className="badge bg-white/5 text-green-300/60 border border-white/10 text-xs px-2 py-1">
            Round {gs?.roundNum ?? 1}
          </span>
        </div>
        <button onClick={() => setShowScores(s => !s)}
          className="btn-ghost text-xs px-3 py-1.5 rounded-lg">
          {showScores ? "Hide scores" : "Scores"}
        </button>
      </div>

      {/* Scores panel */}
      {showScores && (
        <div className="panel p-3 mb-3 animate-float">
          <div className="grid grid-cols-2 gap-2">
            {room.players.map((p, i) => (
              <div key={i} className={`flex justify-between text-xs px-2 py-1.5 rounded-lg bg-white/5 ${p.eliminated ? "opacity-40" : ""}`}>
                <span className="text-green-200">{p.name} {p.id === myId && "(you)"}</span>
                <span className={p.score > 150 ? "text-red-400" : p.score > 100 ? "text-amber-400" : "text-green-400"}>
                  {p.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other players */}
      <div className="mb-3">
        <OtherPlayers players={room.players} currentIdx={gs?.currentIdx ?? 0} myId={myId} />
      </div>

      {/* Phase indicator */}
      {isMyTurn && (
        <div className={`text-xs font-semibold px-3 py-2 rounded-lg mb-3 border ${
          gs?.phase === "pick"
            ? "bg-amber-900/30 text-amber-300 border-amber-500/30"
            : "bg-indigo-900/30 text-indigo-300 border-indigo-500/30"
        }`}>
          {gs?.phase === "pick"
            ? canSkipPick && selectedCards.length > 0
              ? "✓ Same set detected — tap 'Skip Pick & Throw' to play directly"
              : "Step 1 — Pick 1 card from the pile below OR draw from the deck"
            : "Step 2 — Select cards in your hand to throw, then confirm"}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-xs px-3 py-2 rounded-lg mb-3">
          ⚠ {error}
        </div>
      )}

      {/* Opening card */}
      <div className="mb-3">
        <p className="text-green-300/50 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Opening Card</p>
        <div className="flex">
          {gs?.openingCard && <CardFace card={gs.openingCard} small />}
        </div>
      </div>

      {/* Pile / Previous thrown */}
      <div className="mb-3">
        <p className="text-green-300/50 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
          Table Pile {isMyTurn && gs?.phase === "pick" && !canSkipPick ? "— tap to pick" : ""}
        </p>
        <div className="panel p-3 min-h-[90px] flex flex-wrap gap-2 items-center">
          {!gs?.prevThrown || gs.prevThrown.length === 0 ? (
            <span className="text-green-300/25 text-xs">No cards thrown yet</span>
          ) : (
            gs.prevThrown.map(c => (
              <CardFace
                key={c.id}
                card={c}
                pickable={isMyTurn && gs.phase === "pick" && !canSkipPick}
                onClick={() => pickFromPile(c)}
              />
            ))
          )}
        </div>
      </div>

      {/* Draw from stack button */}
      {isMyTurn && gs?.phase === "pick" && !canSkipPick && (
        <button onClick={drawFromStack}
          disabled={!gs?.deckCount}
          className="btn-ghost w-full py-2.5 rounded-xl text-sm mb-3">
          Draw from deck ({gs?.deckCount ?? 0} remaining)
        </button>
      )}

      {/* Skip pick & direct throw (when matching previous) */}
      {isMyTurn && gs?.phase === "pick" && canSkipPick && selectedCards.length > 0 && (
        <button onClick={skipPick}
          className="btn-gold w-full py-2.5 rounded-xl text-sm mb-3 font-semibold">
          Skip Pick & Prepare Throw ✓
        </button>
      )}

      {/* My hand */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-green-300/50 text-[10px] font-semibold uppercase tracking-wider">
            Your Hand — Sum: <span className="text-gold-400">{mySum}</span>
          </p>
          {selectedIds.length > 0 && (
            <span className="text-gold-400/70 text-xs">{selectedIds.length} selected</span>
          )}
        </div>
        <div className="panel p-3 min-h-[90px] flex flex-wrap gap-2 items-end">
          {myHand.length === 0 ? (
            <span className="text-green-300/25 text-xs">No cards</span>
          ) : myHand.map((c, i) => (
            <CardFace
              key={c.id}
              card={c}
              selected={selectedIds.includes(c.id)}
              dimmed={!isMyTurn || gs?.phase === "pick"}
              onClick={() => toggleSelect(c)}
              animDelay={i * 40}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2.5">
        <button
          onClick={confirmThrow}
          disabled={!isMyTurn || gs?.phase !== "throw" || selectedIds.length === 0}
          className="btn-gold flex-1 py-3 rounded-xl text-sm font-semibold"
        >
          Throw Selected ({selectedIds.length})
        </button>
        <button
          onClick={callShow}
          disabled={!isMyTurn}
          className="btn-danger px-5 py-3 rounded-xl text-sm font-semibold"
        >
          Show!
        </button>
      </div>

      {/* Spectator mode while waiting */}
      {!isMyTurn && (
        <p className="text-center text-green-300/35 text-xs mt-3">
          Waiting for {currentPlayer?.name ?? "..."} to play…
        </p>
      )}

      {/* Game log */}
      <div className="mt-4 panel p-3 max-h-24 overflow-y-auto">
        {gs?.log?.slice().reverse().map((l, i) => (
          <p key={i} className="text-green-300/40 text-[11px] leading-relaxed">{l}</p>
        ))}
      </div>
    </div>
  );
}
