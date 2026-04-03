export const RANK_ORDER = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
export const RANK_VALUE = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };
export const RED_SUITS = new Set(["♥", "♦"]);

export function cardValue(card) {
  if (!card || card.isJoker) return 0;
  return RANK_VALUE[card.rank] ?? 0;
}

export function handSum(cards) {
  if (!cards) return 0;
  return cards.reduce((s, c) => s + cardValue(c), 0);
}

export function isRed(card) {
  return !card.isJoker && RED_SUITS.has(card.suit);
}

export function cardLabel(card) {
  if (card.isJoker) return "JKR★";
  return `${card.rank}${card.suit}`;
}

export function validateThrow(cards) {
  if (!cards || cards.length === 0) return { valid: false, reason: "No cards selected" };

  const nonJoker = cards.filter(c => !c.isJoker);
  const jokers = cards.filter(c => c.isJoker);

  // All jokers — need >= 2
  if (nonJoker.length === 0) {
    if (cards.length >= 2) return { valid: true, type: "set" };
    return { valid: false, reason: "Cannot throw a single joker alone" };
  }

  // Same-rank set (≥ 2 cards)
  if (cards.length >= 2) {
    const ranks = nonJoker.map(c => c.rank);
    if (ranks.every(r => r === ranks[0])) return { valid: true, type: "set" };
  }

  // Consecutive sequence (≥ 3 cards), jokers fill gaps
  if (cards.length >= 3) {
    const orders = nonJoker.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
    const min = orders[0], max = orders[orders.length - 1];
    const span = max - min + 1;
    let gaps = 0;
    for (let i = 0; i < orders.length - 1; i++) gaps += orders[i + 1] - orders[i] - 1;
    if (span === cards.length && (gaps === 0 || gaps === jokers.length)) {
      return { valid: true, type: "sequence" };
    }
  }

  if (cards.length === 1) {
    return { valid: false, reason: "Cannot throw 1 card — need ≥2 same rank OR ≥3 consecutive" };
  }
  return { valid: false, reason: "Invalid — need ≥2 same rank OR ≥3 consecutive sequence" };
}

// Returns true if selected cards have the exact same rank AND same count as the pile.
// This means the current player doesn't need to pick after throwing.
// Note: the opening card is a single card pile — matching it means throwing 1 card of the same rank,
// but since throwing 1 card alone is invalid, the opening card pile can NEVER trigger skip.
// This correctly forces the first player (and any player whose prev pile is 1 card) to always pick.
export function matchesPrevious(selected, prevThrown) {
  if (!prevThrown || prevThrown.length === 0) return false;
  if (selected.length !== prevThrown.length) return false;
  // Can't skip pick if pile only has 1 card (opening card or single-card pile)
  // because you can't throw 1 card, so if counts match at 1, it's impossible
  if (selected.length < 2) return false;

  const prevNJ = prevThrown.filter(c => !c.isJoker);
  const selNJ = selected.filter(c => !c.isJoker);

  if (!prevNJ.length || !selNJ.length) return false;

  const pr = prevNJ[0].rank;
  const sr = selNJ[0].rank;

  // Both must be pure same-rank sets (not sequences) with matching rank
  return (
    pr === sr &&
    prevNJ.every(c => c.rank === pr) &&
    selNJ.every(c => c.rank === sr)
  );
}
