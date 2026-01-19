module.exports = (io, socket, rooms) => {
  socket.on("GUESS", ({ code, guess }) => {
    const room = rooms.get(code);
    if (!room || !room.allowGuessing) return;

    if (!guess) return;

    if (guess.trim().toLowerCase() === room.currentWord.toLowerCase()) {
      io.to(code).emit("CORRECT_GUESS", {
        userId: socket.userId,
        word: room.currentWord,
      });
    }
  });
};
