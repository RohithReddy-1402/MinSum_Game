// ─── Constants ────────────────────────────────────────────────────────────────
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_ORDER = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
const RANK_VALUE = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };

// ─── Deck ─────────────────────────────────────────────────────────────────────
function buildDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit, id: id++, isJoker: false });
  // 2 jokers
  deck.push({ rank: "JKR", suit: "★", id: id++, isJoker: true });
  deck.push({ rank: "JKR", suit: "★", id: id++, isJoker: true });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(card) {
  if (card.isJoker) return 0;
  return RANK_VALUE[card.rank] ?? 0;
}

function handSum(cards) {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateThrow(cards) {
  if (!cards || cards.length === 0) return { valid: false, reason: "No cards selected" };

  const nonJoker = cards.filter(c => !c.isJoker);
  const jokers = cards.filter(c => c.isJoker);

  // All jokers — need >= 2
  if (nonJoker.length === 0) {
    if (cards.length >= 2) return { valid: true, type: "set" };
    return { valid: false, reason: "Cannot throw a single joker alone" };
  }

  // Same-number set (≥ 2 cards, all same rank)
  if (cards.length >= 2) {
    const ranks = nonJoker.map(c => c.rank);
    if (ranks.every(r => r === ranks[0])) return { valid: true, type: "set" };
  }

  // Sequence (≥ 3 consecutive, jokers fill gaps)
  if (cards.length >= 3) {
    const orders = nonJoker.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
    const min = orders[0];
    const max = orders[orders.length - 1];
    const span = max - min + 1;

    // Count gaps
    let gaps = 0;
    for (let i = 0; i < orders.length - 1; i++) gaps += orders[i + 1] - orders[i] - 1;

    // All slots filled by non-jokers
    if (span === cards.length && gaps === 0) return { valid: true, type: "sequence" };

    // Gaps filled exactly by jokers
    if (gaps === jokers.length && span === cards.length) return { valid: true, type: "sequence" };
  }

  if (cards.length === 1) return { valid: false, reason: "Cannot throw a single card (need ≥2 same rank or ≥3 sequence)" };
  return { valid: false, reason: "Invalid set — need ≥2 same rank OR ≥3 consecutive sequence" };
}

// Same rank AND same count as previous throw → no pick needed
function matchesPrevious(selected, prevThrown) {
  if (!prevThrown || prevThrown.length === 0) return false;
  if (selected.length !== prevThrown.length) return false;

  const prevNonJoker = prevThrown.filter(c => !c.isJoker);
  const selNonJoker = selected.filter(c => !c.isJoker);

  if (prevNonJoker.length === 0 || selNonJoker.length === 0) return false;

  const prevRank = prevNonJoker[0].rank;
  const selRank = selNonJoker[0].rank;

  return (
    prevRank === selRank &&
    prevNonJoker.every(c => c.rank === prevRank) &&
    selNonJoker.every(c => c.rank === selRank)
  );
}

// ─── Room / Game State ────────────────────────────────────────────────────────
function getNextActiveIndex(players, currentIdx) {
  let next = (currentIdx + 1) % players.length;
  let tries = 0;
  while (players[next].eliminated && tries < players.length) {
    next = (next + 1) % players.length;
    tries++;
  }
  return next;
}

function dealRound(players, cardsEach) {
  const deck = shuffle(buildDeck());
  const activePlayers = players.filter(p => !p.eliminated);
  let di = 0;

  const updatedPlayers = players.map(p => {
    if (p.eliminated) return p;
    const hand = deck.slice(di * cardsEach, (di + 1) * cardsEach);
    di++;
    return { ...p, hand };
  });

  const openingCard = deck[di * cardsEach];
  const remainingDeck = deck.slice(di * cardsEach + 1);

  return { players: updatedPlayers, openingCard, deck: remainingDeck };
}

function resolveShow(players, callerIdx, config) {
  const { showPenalty } = config;
  const callerSum = handSum(players[callerIdx].hand);

  // Find if any other active player has lower or equal sum
  let fakeShow = false;
  for (let i = 0; i < players.length; i++) {
    if (players[i].eliminated || i === callerIdx) continue;
    if (handSum(players[i].hand) <= callerSum) {
      fakeShow = true;
      break;
    }
  }

  const newScores = players.map((p, i) => {
    if (p.eliminated) return p.score;
    if (fakeShow) {
      // Only caller pays fixed penalty
      return p.score + (i === callerIdx ? showPenalty : 0);
    } else {
      // Caller wins — every other active player pays their hand sum
      return p.score + (i === callerIdx ? 0 : handSum(p.hand));
    }
  });

  const updatedPlayers = players.map((p, i) => ({
    ...p,
    score: newScores[i],
    eliminated: p.eliminated || newScores[i] >= config.penaltyLimit,
  }));

  return {
    players: updatedPlayers,
    fakeShow,
    callerIdx,
    callerSum,
    handSums: players.map(p => handSum(p.hand)),
  };
}

module.exports = {
  buildDeck, shuffle, cardValue, handSum,
  validateThrow, matchesPrevious,
  getNextActiveIndex, dealRound, resolveShow,
};
