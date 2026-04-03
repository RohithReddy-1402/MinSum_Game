import { useState, useCallback } from "react";
import { CardFace, CardBackStack } from "./Card";
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
  const isHost = room.hostId === myId;
  const myHand = myPlayer?.hand || [];

  // Cards currently selected from my hand
  const selectedCards = myHand.filter(c => selectedIds.includes(c.id));

  // The pile that can be picked from (only available after I throw, during pick phase)
  const pickablePile = gs?.pickablePile || [];

  // Would my selected cards match the current pile? (to inform user no pick needed)
  const wouldSkipPick = gs?.phase === "throw" && isMyTurn
    && matchesPrevious(selectedCards, gs?.prevThrown);

  const setErr = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 3500);
  }, []);

  // ── Toggle card selection in hand (only during throw phase, your turn) ──────
  function toggleSelect(card) {
    if (!isMyTurn || gs?.phase !== "throw") return;
    setSelectedIds(prev =>
      prev.includes(card.id)
        ? prev.filter(id => id !== card.id)
        : [...prev, card.id]
    );
  }

  // ── Throw selected cards ────────────────────────────────────────────────────
  async function confirmThrow() {
    if (selectedCards.length === 0) return setErr("Select at least 1 valid set of cards to throw");
    const v = validateThrow(selectedCards);
    if (!v.valid) return setErr(v.reason);

    const res = await onAction("game:throw", { cardIds: selectedIds });
    if (!res?.ok) setErr(res?.error || "Failed to throw");
    else setSelectedIds([]);
  }

  // ── Pick 1 card from the pickable pile (after throwing) ─────────────────────
  async function pickFromPile(card) {
    if (!isMyTurn || gs?.phase !== "pick") return;
    const res = await onAction("game:pick_pile", { cardId: card.id });
    if (!res?.ok) setErr(res?.error || "Failed to pick");
  }

  // ── Draw from stack (after throwing) ────────────────────────────────────────
  async function drawFromStack() {
    if (!isMyTurn || gs?.phase !== "pick") return;
    const res = await onAction("game:draw_stack", {});
    if (!res?.ok) setErr(res?.error || "Stack is empty!");
  }

  // ── Call Show (only at start of your turn, before throwing) ─────────────────
  async function callShow() {
    const res = await onAction("game:show", {});
    if (!res?.ok) setErr(res?.error || "Cannot call Show right now");
  }

  const mySum = handSum(myHand);
  const isEliminated = myPlayer?.eliminated;

  // ── Show result overlay ──────────────────────────────────────────────────────
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

  // ── Game over screen ─────────────────────────────────────────────────────────
  if (room.status === "finished" && gs?.winner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="panel p-8 text-center max-w-sm w-full animate-float">
          <div style={{ fontSize: 56, marginBottom: 12 }}>🏆</div>
          <h1 className="font-display text-3xl font-bold text-gold-400 mb-2">{gs.winner} wins!</h1>
          <p className="text-green-200/60 text-sm mb-6">Last player standing</p>
          <div className="space-y-2 mb-6">
            {room.players.map((p, i) => (
              <div key={i} className="flex justify-between text-sm px-3 py-2 rounded-lg bg-white/5">
                <span className={p.eliminated ? "text-red-400 line-through" : "text-green-200"}>
                  {p.name} {p.id === myId ? "(you)" : ""}
                </span>
                <span className={p.score > 150 ? "text-red-400" : "text-green-300"}>{p.score} pts</span>
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

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge px-3 py-1.5 rounded-full font-semibold text-xs ${
            isMyTurn
              ? "bg-gold-500/20 text-gold-400 border border-gold-500/40 animate-pulse"
              : "bg-white/10 text-green-200/70 border border-white/10"
          }`}>
            {isMyTurn
              ? gs?.phase === "pick" ? "Your turn — pick a card!" : "Your turn — throw!"
              : `${currentPlayer?.name ?? "?"}'s turn`}
          </span>
          <span className="badge bg-white/5 text-green-300/60 border border-white/10 text-xs px-2 py-1">
            Stack: {gs?.deckCount ?? "?"}
          </span>
          <span className="badge bg-white/5 text-green-300/60 border border-white/10 text-xs px-2 py-1">
            Round {gs?.roundNum ?? 1}
          </span>
        </div>
        <button onClick={() => setShowScores(s => !s)}
          className="btn-ghost text-xs px-3 py-1.5 rounded-lg flex-shrink-0">
          {showScores ? "Hide" : "Scores"}
        </button>
      </div>

      {/* ── Scores dropdown ── */}
      {showScores && (
        <div className="panel p-3 mb-3 animate-float">
          <div className="grid grid-cols-2 gap-2">
            {room.players.map((p, i) => (
              <div key={i} className={`flex justify-between text-xs px-2 py-1.5 rounded-lg bg-white/5 ${p.eliminated ? "opacity-40" : ""}`}>
                <span className="text-green-200 truncate">{p.name}{p.id === myId ? " (you)" : ""}</span>
                <span className={p.score > 150 ? "text-red-400 font-bold" : p.score > 100 ? "text-amber-400" : "text-green-400"}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Other players (card backs + score) ── */}
      <div className="mb-3">
        <OtherPlayers players={room.players} currentIdx={gs?.currentIdx ?? 0} myId={myId} />
      </div>

      {/* ── Phase banner (only shown on your turn) ── */}
      {isMyTurn && !isEliminated && (
        <div className={`text-xs font-semibold px-3 py-2 rounded-lg mb-3 border ${
          gs?.phase === "pick"
            ? "bg-amber-900/30 text-amber-300 border-amber-500/30"
            : "bg-emerald-900/30 text-emerald-300 border-emerald-500/30"
        }`}>
          {gs?.phase === "pick"
            ? "Step 2 — Pick 1 card from the old pile (below) OR draw from the stack"
            : wouldSkipPick && selectedCards.length > 0
              ? `✓ Same set (${selectedCards.length} cards, same rank) — no pick needed after throwing!`
              : "Step 1 — Select cards from your hand and throw. Show = call if your sum is lowest."}
        </div>
      )}

      {/* ── Error message ── */}
      {error && (
        <div className="bg-red-900/40 border border-red-500/40 text-red-300 text-xs px-3 py-2 rounded-lg mb-3">
          ⚠ {error}
        </div>
      )}

      {/* ── Table pile (current pile on table) ── */}
      <div className="mb-3">
        <p className="text-green-300/50 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
          Table — current pile
          {gs?.lastThrownBy !== null && gs?.lastThrownBy !== undefined
            ? ` (thrown by ${room.players[gs.lastThrownBy]?.name ?? "?"})`
            : " (opening card)"}
        </p>
        <div className="panel p-3 min-h-[90px] flex flex-wrap gap-2 items-center">
          {!gs?.prevThrown || gs.prevThrown.length === 0
            ? <span className="text-green-300/25 text-xs">Empty pile</span>
            : gs.prevThrown.map(c => (
                <CardFace key={c.id} card={c} />
              ))
          }
        </div>
      </div>

      {/* ── Pickable pile — shown only during pick phase ── */}
      {gs?.phase === "pick" && isMyTurn && (
        <div className="mb-3">
          <p className="text-amber-400/70 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
            Old pile — tap any card to pick it
          </p>
          <div className="panel p-3 min-h-[72px] flex flex-wrap gap-2 items-center border border-amber-500/20 bg-amber-900/10">
            {pickablePile.length === 0
              ? <span className="text-green-300/25 text-xs">No cards in old pile</span>
              : pickablePile.map(c => (
                  <CardFace
                    key={c.id}
                    card={c}
                    pickable={true}
                    onClick={() => pickFromPile(c)}
                  />
                ))
            }
          </div>
          <button
            onClick={drawFromStack}
            disabled={!gs?.deckCount}
            className="btn-ghost w-full py-2.5 rounded-xl text-sm mt-2"
          >
            Or draw from stack ({gs?.deckCount ?? 0} remaining)
          </button>
        </div>
      )}

      {/* ── My hand ── */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-green-300/50 text-[10px] font-semibold uppercase tracking-wider">
            Your hand
            {isEliminated
              ? " — eliminated"
              : ` — sum: `}
            {!isEliminated && <span className="text-gold-400 font-bold">{mySum}</span>}
          </p>
          {selectedIds.length > 0 && (
            <span className="text-gold-400/70 text-xs">{selectedIds.length} selected</span>
          )}
        </div>
        <div className={`panel p-3 min-h-[90px] flex flex-wrap gap-2 items-end ${
          isMyTurn && gs?.phase === "throw" ? "border-emerald-500/20" : ""
        }`}>
          {myHand.length === 0
            ? <span className="text-green-300/25 text-xs">No cards in hand</span>
            : myHand.map((c, i) => (
                <CardFace
                  key={c.id}
                  card={c}
                  selected={selectedIds.includes(c.id)}
                  // Dim cards when it's pick phase (can't select hand, must pick from pile/stack)
                  dimmed={!isMyTurn || gs?.phase === "pick" || isEliminated}
                  onClick={() => toggleSelect(c)}
                  animDelay={i * 35}
                />
              ))
          }
        </div>
      </div>

      {/* ── Action buttons — only shown during throw phase ── */}
      {gs?.phase === "throw" && !isEliminated && (
        <div className="flex gap-2.5">
          <button
            onClick={confirmThrow}
            disabled={!isMyTurn || selectedIds.length === 0}
            className="btn-gold flex-1 py-3 rounded-xl text-sm font-semibold"
          >
            {selectedIds.length === 0
              ? "Select cards to throw"
              : wouldSkipPick
                ? `Throw (no pick needed ✓)`
                : `Throw ${selectedIds.length} card${selectedIds.length > 1 ? "s" : ""}`}
          </button>
          <button
            onClick={callShow}
            disabled={!isMyTurn}
            className="btn-danger px-5 py-3 rounded-xl text-sm font-semibold"
          >
            Show!
          </button>
        </div>
      )}

      {/* ── Waiting message when not your turn ── */}
      {!isMyTurn && !isEliminated && (
        <p className="text-center text-green-300/35 text-xs mt-2">
          {gs?.phase === "pick"
            ? `Waiting for ${currentPlayer?.name} to pick a card…`
            : `Waiting for ${currentPlayer?.name} to throw…`}
        </p>
      )}

      {isEliminated && (
        <div className="text-center panel py-3 px-4 mt-2">
          <p className="text-red-400 text-sm font-semibold">You've been eliminated</p>
          <p className="text-green-300/40 text-xs mt-1">Watch the game until it ends</p>
        </div>
      )}

      {/* ── Game log ── */}
      <div className="mt-4 panel p-3 max-h-28 overflow-y-auto">
        <p className="text-green-300/40 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Game log</p>
        {gs?.log?.slice().reverse().map((l, i) => (
          <p key={i} className="text-green-300/40 text-[11px] leading-relaxed border-b border-white/5 pb-1 mb-1 last:border-0 last:mb-0">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}
