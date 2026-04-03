import { CardBackStack } from "./Card";

export default function OtherPlayers({ players, currentIdx, myId }) {
  const others = players
    .map((p, i) => ({ ...p, idx: i }))
    .filter(p => p.id !== myId);

  if (others.length === 0) return null;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(others.length, 3)}, 1fr)` }}>
      {others.map((player) => {
        const isTheirTurn = player.idx === currentIdx;
        return (
          <div
            key={player.id}
            className={`panel p-3 transition-all duration-300 ${
              isTheirTurn ? "your-turn-glow border-gold-500/50" : ""
            } ${player.eliminated ? "opacity-40" : ""}`}
          >
            {/* Player info */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  player.connected ? "bg-green-400" : "bg-gray-500"
                }`} />
                <span className="text-xs font-semibold text-green-100 truncate max-w-[80px]">
                  {player.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isTheirTurn && (
                  <span className="badge bg-gold-500/20 text-gold-400 border border-gold-500/30 text-[10px]">
                    Turn
                  </span>
                )}
                {player.eliminated && (
                  <span className="badge bg-red-900/30 text-red-400 text-[10px]">Out</span>
                )}
              </div>
            </div>

            {/* Score bar */}
            <div className="mb-2.5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-green-300/50">Score</span>
                <span className="text-[10px] font-semibold text-green-200/70">{player.score} pts</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((player.score / 210) * 100))}%`,
                    background: player.score > 150 ? "#ef4444" : player.score > 100 ? "#f59e0b" : "#22c55e",
                  }}
                />
              </div>
            </div>

            {/* Card backs */}
            <div className="flex items-center justify-center py-1">
              {player.cardCount > 0 ? (
                <CardBackStack count={player.cardCount} small />
              ) : (
                <span className="text-green-300/30 text-xs">No cards</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
