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

  // ✅ Single card — always valid (any card)
  if (cards.length === 1) return { valid: true, type: "single" };

  const nonJoker = cards.filter(c => !c.isJoker);
  const jokers = cards.filter(c => c.isJoker);

  // All jokers (2+) — valid set
  if (nonJoker.length === 0) return { valid: true, type: "set" };

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

  return { valid: false, reason: "Invalid — 2 cards must be same rank, 3+ must be consecutive sequence" };
}

// Returns true if selected cards have the exact same rank AND same count as the pile.
// This means the current player doesn't need to pick after throwing.
// Works for singles too: throwing a single card of the same rank as prev single card = skip pick.
export function matchesPrevious(selected, prevThrown) {
  if (!prevThrown || prevThrown.length === 0) return false;
  if (selected.length !== prevThrown.length) return false;

  const prevNJ = prevThrown.filter(c => !c.isJoker);
  const selNJ = selected.filter(c => !c.isJoker);

  // Both all jokers — count matches, skip pick
  if (prevNJ.length === 0 && selNJ.length === 0) return true;
  if (!prevNJ.length || !selNJ.length) return false;

  const pr = prevNJ[0].rank;
  const sr = selNJ[0].rank;

  // Same rank for all non-joker cards in both piles
  return (
    pr === sr &&
    prevNJ.every(c => c.rank === pr) &&
    selNJ.every(c => c.rank === sr)
  );
}
