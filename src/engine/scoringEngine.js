// backend/src/engine/scoringEngine.js

/* =========================
   CONSTANTS
========================= */
const CLASSIC_SCORE = 10;
const KIDS_SCORE = 5;
const MIN_TIMER_SCORE = 5;

/* =========================
   AWARD SCORE
========================= */
function awardScore(room, playerId) {
  if (!room || room.status !== "playing") return false;
  if (!Array.isArray(room.players)) return false;

  // Together mode has no scoring
  if (room.mode === "Together") return false;

  const player = room.players.find(
    p => String(p.id) === String(playerId)
  );

  // Invalid player or already scored (roundEngine enforces this)
  if (!player || player.guessedCorrectly) return false;

  player.score ??= 0;

  let addedScore = 0;

  /* =========================
     MODE-BASED SCORING
  ========================== */

  // 🧒 KIDS MODE → flat low score
  if (room.mode === "Kids") {
    addedScore = KIDS_SCORE;
  }

  // ⚡ QUICK MODE or TIMER GAMEPLAY → time-based
  else if (room.mode === "Quick" || room.gameplay === "Timer") {
    const remaining = Number(room.timerRemaining);
    addedScore = Number.isFinite(remaining)
      ? Math.max(MIN_TIMER_SCORE, remaining)
      : MIN_TIMER_SCORE;
  }

  // 🎨 CLASSIC MODE → flat score
  else {
    addedScore = CLASSIC_SCORE;
  }

  /* =========================
     APPLY SCORE
  ========================== */
  player.score += addedScore;

  console.log(
    `✅ Score awarded → ${player.username} (+${addedScore})`
  );

  return addedScore;
}

module.exports = { awardScore };
