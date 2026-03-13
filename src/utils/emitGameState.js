
module.exports = function emitGameState(io, room) {

  if (!room || !Array.isArray(room.players)) return;

  for (const player of room.players) {

    if (!player.socketId) continue;

    /* =========================
       WORD VISIBILITY
    ========================== */

    let currentWord = null;
    let wordLength = 0;

    if (room.mode === "Together") {

      /* both players see word */

      currentWord = room.currentWord ?? null;

    } else {

      /* guessing modes */

      if (String(player.id) === String(room.drawerId)) {

        /* drawer sees word */

        currentWord = room.currentWord ?? null;

      } else {

        /* guessers only see length */

        wordLength = room.currentWord
          ? room.currentWord.length
          : 0;

      }

    }

    /* =========================
       EMIT GAME STATE
    ========================== */

    io.to(player.socketId).emit("GAME_STATE", {

      /* ROOM INFO */

      code: room.code ?? null,
      type: room.type ?? null,
      mode: room.mode ?? null,
      gameplay: room.gameplay ?? null,
      status: room.status ?? null,
      theme: room.theme ?? null,

      /* ROUND STATE */

      round: room.round ?? 0,
      drawerId: room.drawerId ?? null,
      guessingAllowed: room.guessingAllowed ?? false,

      currentWord,
      wordLength,

      revealedLetters: room.revealedLetters ?? [],

      /* PLAYER CONTEXT */

      selfId: player.id,

      players: room.players.map(p => ({

        id: p.id,
        username: p.username,
        score: p.score ?? 0,
        guessedCorrectly: p.guessedCorrectly ?? false,
        connected: p.connected !== false,
        side: p.side ?? null

      })),

      /* DRAWING STATE */

      drawing: room.drawing ?? []

    });

  }

};
