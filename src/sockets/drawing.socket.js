 // backend/src/sockets/drawing.socket.js

module.exports = (io, socket, rooms) => {

  socket.on("DRAW", ({ code, x, y, prevX, prevY }) => {
    const room = rooms.get(code);
    if (!room || room.status !== "playing" || room.turnEnded) return;

    const player = room.players.find(p => p.id === socket.userId);
    if (!player) return;

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof prevX !== "number" ||
      typeof prevY !== "number"
    ) return;

    room.drawing ??= [];
    room.undoStack ??= [];

    /* ---------- TOGETHER ---------- */
    if (room.mode === "Together") {
      const stroke = { x, y, prevX, prevY, side: player.side };
      room.drawing.push(stroke);
      io.to(code).emit("DRAW", stroke);
      return;
    }

    /* ---------- ONLY DRAWER ---------- */
    if (room.drawerId !== socket.userId) return;

    // ✅ notify engine only
    const { onDrawerDraw } = require("../engine/roundEngine");
    onDrawerDraw(io, room);

    const stroke = { x, y, prevX, prevY };
    room.drawing.push(stroke);
    room.undoStack.length = 0;

    socket.to(code).emit("DRAW", stroke);
  });

  socket.on("UNDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.drawerId !== socket.userId) return;
    if (!room.drawing?.length) return;

    const stroke = room.drawing.pop();
    room.undoStack.push(stroke);

    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  socket.on("REDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.drawerId !== socket.userId) return;
    if (!room.undoStack?.length) return;

    const stroke = room.undoStack.pop();
    room.drawing.push(stroke);

    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  socket.on("REQUEST_DRAW_SYNC", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;

    socket.emit("DRAW_SYNC", room.drawing ?? []);
  });
};
