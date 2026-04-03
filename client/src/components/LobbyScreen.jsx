import { useState } from "react";

export default function LobbyScreen({ onCreateRoom, onJoinRoom, connected }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState("create"); // create | join
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [config, setConfig] = useState({
    cardsEach: 5,
    showPenalty: 50,
    penaltyLimit: 210,
  });

  async function handleCreate() {
    if (!name.trim()) return setError("Enter your name");
    setLoading(true); setError("");
    try { await onCreateRoom(name.trim(), config); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!name.trim()) return setError("Enter your name");
    if (!joinCode.trim()) return setError("Enter room code");
    setLoading(true); setError("");
    try { await onJoinRoom(name.trim(), joinCode.trim().toUpperCase()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-float">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl font-bold text-gold-400 mb-2 tracking-tight">
            Minimum Sum
          </h1>
          <p className="text-green-200/60 text-sm tracking-wide">
            The card game of strategy & nerve
          </p>
          <div className={`mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${
            connected ? "border-green-500/30 text-green-400 bg-green-900/20" : "border-red-500/30 text-red-400 bg-red-900/20"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {connected ? "Connected to server" : "Connecting…"}
          </div>
        </div>

        <div className="panel p-6">
          {/* Name */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-green-300/70 uppercase tracking-wider mb-1.5">
              Your name
            </label>
            <input
              className="input-felt"
              placeholder="Enter your name…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (tab === "create" ? handleCreate() : handleJoin())}
            />
          </div>

          {/* Tabs */}
          <div className="flex mb-5 border border-white/10 rounded-lg overflow-hidden">
            {["create", "join"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-all ${
                  tab === t
                    ? "bg-gold-500 text-felt-900"
                    : "text-green-200/60 hover:text-green-200/90"
                }`}>
                {t === "create" ? "Create Room" : "Join Room"}
              </button>
            ))}
          </div>

          {tab === "create" && (
            <div className="space-y-4 mb-5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-green-300/60 mb-1">Cards each</label>
                  <input type="number" min={3} max={8} value={config.cardsEach}
                    onChange={e => setConfig(c => ({ ...c, cardsEach: +e.target.value }))}
                    className="input-felt" />
                </div>
                <div>
                  <label className="block text-xs text-green-300/60 mb-1">Show penalty</label>
                  <input type="number" min={10} max={200} value={config.showPenalty}
                    onChange={e => setConfig(c => ({ ...c, showPenalty: +e.target.value }))}
                    className="input-felt" />
                </div>
                <div>
                  <label className="block text-xs text-green-300/60 mb-1">Elim. at pts</label>
                  <input type="number" min={100} max={500} value={config.penaltyLimit}
                    onChange={e => setConfig(c => ({ ...c, penaltyLimit: +e.target.value }))}
                    className="input-felt" />
                </div>
              </div>
            </div>
          )}

          {tab === "join" && (
            <div className="mb-5">
              <label className="block text-xs font-semibold text-green-300/70 uppercase tracking-wider mb-1.5">
                Room code
              </label>
              <input
                className="input-felt text-center text-2xl font-bold tracking-widest uppercase"
                placeholder="XXXXXX"
                maxLength={6}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
              />
            </div>
          )}

          {error && (
            <div className="mb-4 text-red-400 text-sm text-center bg-red-900/20 border border-red-500/20 rounded-lg py-2 px-3">
              {error}
            </div>
          )}

          <button
            onClick={tab === "create" ? handleCreate : handleJoin}
            disabled={loading || !connected}
            className="btn-gold w-full py-3 rounded-xl text-sm font-semibold"
          >
            {loading ? "Connecting…" : tab === "create" ? "Create Room →" : "Join Room →"}
          </button>
        </div>

        {/* Rules quick ref */}
        <div className="mt-4 panel p-4">
          <p className="text-gold-400/80 text-xs font-semibold mb-2 uppercase tracking-wider">Rules at a glance</p>
          <ul className="text-green-100/50 text-xs space-y-1">
            <li>• Pick 1 card (from pile or deck), then throw a valid set</li>
            <li>• Throw ≥2 same-rank OR ≥3 consecutive (A 2 3 … J Q K)</li>
            <li>• Same rank + same count as prev → skip the pick!</li>
            <li>• Call Show when your hand sum is lowest</li>
            <li>• Fake show → you pay the penalty, not others</li>
            <li>• Joker = 0 points &nbsp;|&nbsp; Reach {210} pts → eliminated</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
