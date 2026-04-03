import { CardFace } from "./Card";
import { handSum } from "../utils/game";

export default function ShowResult({ result, isHost, onNextRound, onNewGame, config }) {
  if (!result) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 50, padding: 16,
    }}>
      <div className="panel animate-float" style={{ maxWidth: 520, width: "100%", padding: 24 }}>
        <div className="text-center mb-5">
          <div style={{ fontSize: 40, marginBottom: 8 }}>
            {result.fakeShow ? "💸" : "🏆"}
          </div>
          <h2 className="font-display text-2xl font-bold text-gold-400 mb-1">
            {result.fakeShow ? "Fake Show!" : "Show!"}
          </h2>
          <p className="text-green-200/70 text-sm">{result.resultMsg}</p>
        </div>

        <div className="space-y-3 mb-5">
          {result.players.map((p, i) => (
            <div key={i} className={`rounded-xl p-3 border transition-all ${
              p.penaltyGiven
                ? "border-red-500/30 bg-red-900/20"
                : "border-green-500/30 bg-green-900/10"
            } ${p.eliminated ? "opacity-60" : ""}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm text-green-100">{p.name}</span>
                <div className="flex items-center gap-2">
                  {p.eliminated && (
                    <span className="badge bg-red-900/40 text-red-400 text-[10px]">Eliminated</span>
                  )}
                  <span className={`badge text-[10px] ${
                    p.penaltyGiven
                      ? "bg-red-900/40 text-red-400 border border-red-500/30"
                      : "bg-green-900/40 text-green-400 border border-green-500/30"
                  }`}>
                    {p.penaltyGiven ? `+${p.penaltyPoints ?? p.sum} pts` : "Safe ✓"}
                  </span>
                </div>
              </div>

              {/* Hand reveal */}
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {p.hand && p.hand.map(c => (
                  <CardFace key={c.id} card={c} small />
                ))}
              </div>

              <div className="flex justify-between text-xs text-green-300/60">
                <span>Sum: <span className="text-green-200 font-semibold">{p.sum}</span></span>
                <span>Total score: <span className="text-green-200 font-semibold">{p.score}</span> / {config?.penaltyLimit ?? 210}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          {isHost && !result.gameOver ? (
            <button onClick={onNextRound} className="btn-gold flex-1 py-3 rounded-xl text-sm font-semibold">
              Next Round →
            </button>
          ) : !isHost && !result.gameOver ? (
            <div className="flex-1 text-center text-green-300/50 text-sm panel py-3 rounded-xl">
              Waiting for host to start next round…
            </div>
          ) : null}
          <button onClick={onNewGame} className="btn-ghost flex-1 py-3 rounded-xl text-sm font-semibold">
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
