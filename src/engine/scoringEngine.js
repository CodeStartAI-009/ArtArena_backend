function awardScore(room, playerId) {
  if (!room || room.status !== "playing") return false;
  if (!Array.isArray(room.players)) return false;
  if (room.mode === "Together") return false;

  const player = room.players.find(
    p => String(p.id) === String(playerId)
  );

  if (!player || player.guessedCorrectly) return false;

  player.score ??= 0;

  const added =
    room.gameplay === "Timer"
      ? Math.max(5, Number(room.timer) || 0)
      : 10;

  player.score += added;
  player.guessedCorrectly = true;

  console.log(
    `✅ Score awarded → ${player.username} (+${added})`
  );

  return true;
}

module.exports = { awardScore };
