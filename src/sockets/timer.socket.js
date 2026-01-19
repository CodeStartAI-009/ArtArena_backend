const timerEngine = require("../engine/timerEngine");

module.exports = (io, socket, rooms) => {

  socket.on("ALLOW_GUESSING", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.allowGuessing) return;

    room.allowGuessing = true;

    timerEngine.startTimer(
      io,
      room,
      room.gameplay === "Quick" ? 20 : 40
    );

    io.to(code).emit("GUESSING_STARTED");
  });

};
