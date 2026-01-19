/**
 * Awards score to a player on correct guess.
 * Safe against reconnects, duplicates, and invalid state.
 *
 * @returns {boolean} true if score was awarded (first correct guess this round)
 */
function awardScore(room, playerId) {
  /* ================= SAFETY GUARDS ================= */
  if (!room || typeof room !== "object") {
    console.warn("⚠️ awardScore: invalid room");
    return false;
  }

  if (!Array.isArray(room.players)) {
    console.warn("⚠️ awardScore: room.players missing", room.code);
    return false;
  }

  if (!playerId) {
    console.warn("⚠️ awardScore: missing playerId");
    return false;
  }

  /* ================= TOGETHER MODE ================= */
  if (room.mode === "Together") {
    return false; // ❌ no scoring in Together
  }

  /* ================= FIND PLAYER ================= */
  const player = room.players.find(p => p.id === playerId);

  if (!player) {
    console.warn(
      `⚠️ awardScore: player ${playerId} not found in room ${room.code}`
    );
    return false;
  }

  /* ================= DUPLICATE PROTECTION ================= */
  if (player.guessedCorrectly === true) {
    return false; // already scored this turn
  }

  /* ================= APPLY SCORE ================= */
  player.guessedCorrectly = true;

  if (typeof player.score !== "number") {
    player.score = 0;
  }

  let added = 0;

  switch (room.gameplay) {
    case "Timer": {
      const remaining = typeof room.timer === "number" ? room.timer : 0;
      added = Math.max(5, remaining);
      break;
    }

    case "Score":
    default:
      added = 10;
      break;
  }

  player.score += added;

  console.log(
    `✅ Score awarded → ${player.username} (+${added}, total: ${player.score})`
  );

  return true; // 🔥 caller can safely trigger first-guess logic
}

module.exports = {
  awardScore,
};
