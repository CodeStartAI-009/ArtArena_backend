const User = require("../models/User");

/**
 * Apply XP / coin reward for a correct guess
 */
async function applyRewards(userId, reward) {
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  const xp = reward?.xp ?? 0;
  const coins = reward?.coins ?? 0;

  user.xp += xp;
  user.coins += coins;

  while (user.xp >= 100) {
    user.level += 1;
    user.xp -= 100;
  }

  await user.save();

  return {
    user,
    xpEarned: xp,
    coinsEarned: coins,
  };
}

module.exports = { applyRewards };
