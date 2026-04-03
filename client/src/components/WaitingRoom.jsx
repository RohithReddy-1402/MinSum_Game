import { useState } from "react";

export default function WaitingRoom({ room, myId, onStartGame, onConfigChange }) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myId;

  function copyCode() {
    navigator.clipboard.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cfg = room.config;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-float">
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl font-bold text-gold-400 mb-1">Waiting Room</h1>
          <p className="text-green-200/50 text-sm">Share the code with your friends</p>
        </div>

        {/* Room code */}
        <div className="panel p-5 mb-4 text-center">
          <p className="text-green-300/60 text-xs font-semibold uppercase tracking-wider mb-2">Room Code</p>
          <div className="font-display text-5xl font-bold text-gold-400 tracking-widest mb-3">
            {room.code}
          </div>
          <button onClick={copyCode} className="btn-ghost text-sm px-5 py-2 rounded-lg">
            {copied ? "✓ Copied!" : "Copy code"}
          </button>
        </div>

        {/* Players */}
        <div className="panel p-4 mb-4">
          <p className="text-green-300/60 text-xs font-semibold uppercase tracking-wider mb-3">
            Players ({room.players.length}/6)
          </p>
          <div className="space-y-2">
            {room.players.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                  <span className="text-sm font-medium text-green-100">
                    {p.name}
                    {p.id === myId && <span className="text-gold-400 text-xs ml-1">(you)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {room.hostId === p.id && (
                    <span className="badge bg-gold-500/20 text-gold-400 border border-gold-500/30">Host</span>
                  )}
                  {!p.connected && (
                    <span className="badge bg-red-900/30 text-red-400">Disconnected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Config (host only) */}
        {isHost && (
          <div className="panel p-4 mb-4">
            <p className="text-green-300/60 text-xs font-semibold uppercase tracking-wider mb-3">Game Settings</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-green-300/50 mb-1">Cards each</label>
                <input type="number" min={3} max={8} value={cfg.cardsEach}
                  onChange={e => onConfigChange({ ...cfg, cardsEach: +e.target.value })}
                  className="input-felt text-center" />
              </div>
              <div>
                <label className="block text-xs text-green-300/50 mb-1">Show penalty</label>
                <input type="number" min={10} max={200} value={cfg.showPenalty}
                  onChange={e => onConfigChange({ ...cfg, showPenalty: +e.target.value })}
                  className="input-felt text-center" />
              </div>
              <div>
                <label className="block text-xs text-green-300/50 mb-1">Elim. at pts</label>
                <input type="number" min={100} max={500} value={cfg.penaltyLimit}
                  onChange={e => onConfigChange({ ...cfg, penaltyLimit: +e.target.value })}
                  className="input-felt text-center" />
              </div>
            </div>
          </div>
        )}

        {!isHost && (
          <div className="panel p-4 mb-4">
            <p className="text-green-300/60 text-xs font-semibold uppercase tracking-wider mb-2">Game Settings</p>
            <div className="flex gap-4 text-sm text-green-100/70">
              <span>{cfg.cardsEach} cards each</span>
              <span>·</span>
              <span>{cfg.showPenalty} pts fake show</span>
              <span>·</span>
              <span>Eliminate at {cfg.penaltyLimit}</span>
            </div>
          </div>
        )}

        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={room.players.length < 2}
            className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold"
          >
            {room.players.length < 2 ? "Waiting for players (need 2+)…" : `Start Game with ${room.players.length} players →`}
          </button>
        ) : (
          <div className="text-center text-green-200/40 text-sm panel p-4">
            Waiting for the host to start the game…
          </div>
        )}
      </div>
    </div>
  );
}
