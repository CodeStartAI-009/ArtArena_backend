
/* =========================
   CONSTANTS
========================= */

const CLASSIC_BASE = 15;
const KIDS_BASE = 5;
const QUICK_BASE = 20;

const MIN_SCORE = 5;

/* =========================
   CALCULATE RANK BONUS
========================= */

function calculateRankScore(base, position) {

  const deduction = (position - 1) * 5;

  return Math.max(MIN_SCORE, base - deduction);

}

/* =========================
   AWARD SCORE
========================= */

function awardScore(room, playerId) {

  if (!room) return 0;
  if (!Array.isArray(room.players)) return 0;
  if (room.mode === "Together") return 0;

  const player = room.players.find(
    p => String(p.id) === String(playerId)
  );

  if (!player) return 0;

  /* prevent double scoring */

  if (player.guessedCorrectly) return 0;

  player.score ??= 0;

  /* ensure correctGuessers exists */

  if (!room.correctGuessers) {
    room.correctGuessers = new Set();
  }

  let baseScore = 0;

  /* =========================
     MODE BASE SCORE
  ========================== */

  if (room.mode === "Kids") {
    baseScore = KIDS_BASE;
  }

  else if (room.mode === "Quick" || room.gameplay === "Timer") {
    baseScore = QUICK_BASE;
  }

  else {
    baseScore = CLASSIC_BASE;
  }

  /* =========================
     DETERMINE GUESS ORDER
  ========================== */

  const position = room.correctGuessers.size + 1;

  const addedScore = calculateRankScore(baseScore, position);

  /* =========================
     APPLY SCORE
  ========================== */

  player.score += addedScore;

  console.log(
    `✅ ${player.username} guessed #${position} (+${addedScore})`
  );

  return addedScore;

}

module.exports = { awardScore };
