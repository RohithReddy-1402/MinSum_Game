import { isRed } from "../utils/game";

export function CardFace({ card, selected, onClick, pickable, dimmed, small, style = {}, animDelay = 0 }) {
  const red = !card.isJoker && isRed(card);
  const joker = card.isJoker;

  return (
    <div
      onClick={onClick}
      className={`card-face flex flex-col items-center justify-center cursor-pointer select-none
        ${selected ? "selected" : ""}
        ${pickable ? "pickable" : ""}
        ${dimmed ? "opacity-40 pointer-events-none" : ""}
      `}
      style={{
        width: small ? 38 : 52,
        height: small ? 54 : 74,
        flexShrink: 0,
        animationDelay: `${animDelay}ms`,
        ...style,
      }}
    >
      {joker ? (
        <div style={{ textAlign: "center", lineHeight: 1.2 }}>
          <div style={{ fontSize: small ? 9 : 11, fontWeight: 700, color: "#2563eb" }}>JKR</div>
          <div style={{ fontSize: small ? 12 : 16, color: "#2563eb" }}>★</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: small ? 11 : 14, fontWeight: 700, color: red ? "#b91c1c" : "#1c1917", lineHeight: 1 }}>
            {card.rank}
          </div>
          <div style={{ fontSize: small ? 13 : 18, color: red ? "#b91c1c" : "#1c1917", lineHeight: 1, marginTop: 1 }}>
            {card.suit}
          </div>
        </>
      )}
    </div>
  );
}

export function CardBack({ small, style = {}, animDelay = 0, count }) {
  return (
    <div
      className="card-back flex items-center justify-center animate-deal"
      style={{
        width: small ? 38 : 52,
        height: small ? 54 : 74,
        flexShrink: 0,
        animationDelay: `${animDelay}ms`,
        position: "relative",
        ...style,
      }}
    >
      {count !== undefined && (
        <div style={{
          position: "absolute",
          top: -6, right: -6,
          background: "#e6b020",
          color: "#0a1f0e",
          borderRadius: "50%",
          width: 18, height: 18,
          fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }}>
          {count}
        </div>
      )}
    </div>
  );
}

// Stacked back cards to show how many cards someone has
export function CardBackStack({ count, small }) {
  const visible = Math.min(count, 5);
  return (
    <div style={{ position: "relative", width: small ? 38 + (visible - 1) * 8 : 52 + (visible - 1) * 10, height: small ? 54 : 74 }}>
      {Array.from({ length: visible }).map((_, i) => (
        <div
          key={i}
          className="card-back"
          style={{
            position: "absolute",
            left: i * (small ? 8 : 10),
            top: 0,
            width: small ? 38 : 52,
            height: small ? 54 : 74,
            zIndex: i,
          }}
        />
      ))}
      {count > 0 && (
        <div style={{
          position: "absolute",
          top: -8, right: -8,
          background: "#e6b020",
          color: "#0a1f0e",
          borderRadius: "50%",
          width: 20, height: 20,
          fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }}>
          {count}
        </div>
      )}
    </div>
  );
}
