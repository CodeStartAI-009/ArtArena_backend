const { endGame } = require("./gameEngine");

function checkGameEnd(io, room) {
  if (!room || room.status !== "playing") return false;

  // 🧩 TOGETHER MODE → manual only
  if (room.mode === "Together") {
    return false;
  }

  /* ================= SCORE BASED END ================= */
  if (typeof room.maxScore === "number") {
    const winner = room.players.find(
      p => typeof p.score === "number" && p.score >= room.maxScore
    );

    if (winner) {
      console.log(
        `🏁 GAME END (MAX SCORE) → ${winner.username} reached ${room.maxScore}`
      );
      endGame(io, room);
      return true;
    }
  }

  /* ================= ROUND BASED END ================= */
  if (
    typeof room.totalRounds === "number" &&
    room.round > room.totalRounds
  ) {
    console.log(
      `🏁 GAME END (MAX ROUNDS) → Round ${room.round - 1}`
    );
    endGame(io, room);
    return true;
  }

  return false;
}

module.exports = checkGameEnd;
