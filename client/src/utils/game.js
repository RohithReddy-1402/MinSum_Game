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
  if (card.isJoker) return "JKR ★";
  return `${card.rank}${card.suit}`;
}

export function validateThrow(cards) {
  if (!cards || cards.length === 0) return { valid: false, reason: "No cards selected" };

  const nonJoker = cards.filter(c => !c.isJoker);
  const jokers = cards.filter(c => c.isJoker);

  if (nonJoker.length === 0) {
    if (cards.length >= 2) return { valid: true, type: "set" };
    return { valid: false, reason: "Cannot throw a single joker" };
  }

  if (cards.length >= 2) {
    const ranks = nonJoker.map(c => c.rank);
    if (ranks.every(r => r === ranks[0])) return { valid: true, type: "set" };
  }

  if (cards.length >= 3) {
    const orders = nonJoker.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
    const min = orders[0], max = orders[orders.length - 1];
    const span = max - min + 1;
    let gaps = 0;
    for (let i = 0; i < orders.length - 1; i++) gaps += orders[i + 1] - orders[i] - 1;
    if (span === cards.length && (gaps === 0 || gaps === jokers.length)) return { valid: true, type: "sequence" };
  }

  if (cards.length === 1) return { valid: false, reason: "Cannot throw 1 card alone (need ≥2 same rank or ≥3 sequence)" };
  return { valid: false, reason: "Invalid — need ≥2 same rank OR ≥3 consecutive sequence" };
}

export function matchesPrevious(selected, prevThrown) {
  if (!prevThrown || prevThrown.length === 0) return false;
  if (selected.length !== prevThrown.length) return false;
  const prevNJ = prevThrown.filter(c => !c.isJoker);
  const selNJ = selected.filter(c => !c.isJoker);
  if (!prevNJ.length || !selNJ.length) return false;
  const pr = prevNJ[0].rank, sr = selNJ[0].rank;
  return pr === sr && prevNJ.every(c => c.rank === pr) && selNJ.every(c => c.rank === sr);
}
