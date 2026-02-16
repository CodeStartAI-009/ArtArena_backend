// backend/src/engine/scoringEngine.js

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
  // position starts from 1
  const deduction = (position - 1) * 5;
  return Math.max(MIN_SCORE, base - deduction);
}

/* =========================
   AWARD SCORE
========================= */
function awardScore(room, playerId) {
  if (!room || room.status !== "playing") return false;
  if (!Array.isArray(room.players)) return false;
  if (room.mode === "Together") return false;

  const player = room.players.find(
    p => String(p.id) === String(playerId)
  );

  if (!player || player.guessedCorrectly) return false;

  player.score ??= 0;

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

  const position = room.correctGuessers
    ? room.correctGuessers.size + 1 // +1 because player not yet added
    : 1;

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
