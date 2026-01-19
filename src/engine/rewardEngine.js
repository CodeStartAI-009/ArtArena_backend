const User = require("../models/User");

async function applyRewards(player) {
  if (!player?.id) return null;

  const user = await User.findById(player.id);
  if (!user) return null;

  const score = player.score ?? 0;

  const xpEarned = score * 10;
  const coinsEarned = score * 5;

  user.xp += xpEarned;
  user.coins += coinsEarned;

  while (user.xp >= 100) {
    user.level += 1;
    user.xp -= 100;
  }

  await user.save();

  return {
    user,          // ✅ THIS IS WHAT YOU WERE MISSING
    xpEarned,
    coinsEarned,
  };
}

module.exports = { applyRewards };
