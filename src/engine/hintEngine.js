const User = require("../models/User");

const HINT_COST = 5;

async function requestHint(io, room, userId) {
  if (!room || room.status !== "playing") return;
  if (!room.guessingAllowed) return;
  if (!room.currentWord) return;

  // 🚫 Drawer cannot buy hints
  if (room.drawerId === userId) return;

  const player = room.players.find(p => p.id === userId);
  if (!player) return;

  // Load user from DB (authoritative)
  const user = await User.findById(userId);
  if (!user) return;

  if (user.gems < HINT_COST) {
    io.to(player.socketId).emit("HINT_DENIED", {
      reason: "NOT_ENOUGH_GEMS",
    });
    return;
  }

  // Find unrevealed indexes
  const unrevealed = [];
  for (let i = 0; i < room.currentWord.length; i++) {
    if (!room.revealedLetters.includes(i)) {
      unrevealed.push(i);
    }
  }

  if (!unrevealed.length) return;

  // Pick random unrevealed letter
  const index =
    unrevealed[Math.floor(Math.random() * unrevealed.length)];

  room.revealedLetters.push(index);

  // Deduct gems (DB)
  user.gems -= HINT_COST;
  await user.save();

  // Sync to everyone
  io.to(room.code).emit("HINT_REVEALED", {
    index,
    gemsLeft: user.gems,
  });
}

module.exports = {
  requestHint,
};
