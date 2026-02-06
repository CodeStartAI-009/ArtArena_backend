// backend/src/sockets/drawing.socket.js

module.exports = (io, socket, rooms) => {

  /* =========================
     DRAW
  ========================== */
  socket.on("DRAW", ({ code, x, y, prevX, prevY, color, tool }) => {
    const room = rooms.get(code);
    if (!room || room.status !== "playing" || room.turnEnded) return;

    const player = room.players.find(p => p.id === socket.userId);
    if (!player) return;

    // Strict validation
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof prevX !== "number" ||
      typeof prevY !== "number"
    ) return;

    room.drawing ??= [];
    room.undoStack ??= [];

    const stroke = {
      x,
      y,
      prevX,
      prevY,
      color: typeof color === "string" ? color : "#000",
      tool: tool === "erase" ? "erase" : "draw", // ✅ CRITICAL
    };

    /* ---------- TOGETHER MODE ---------- */
    if (room.mode === "Together") {
      stroke.side = player.side; // left / right

      room.drawing.push(stroke);
      io.to(code).emit("DRAW", stroke);
      return;
    }

    /* ---------- CLASSIC / QUICK / KIDS ---------- */
    if (room.drawerId !== socket.userId) return;

    // Notify round engine (anti-idle / anti-cheat)
    const { onDrawerDraw } = require("../engine/roundEngine");
    onDrawerDraw(io, room);

    room.drawing.push(stroke);
    room.undoStack.length = 0;

    socket.to(code).emit("DRAW", stroke);
  });

  /* =========================
     UNDO (drawer only)
  ========================== */
  socket.on("UNDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.drawerId !== socket.userId) return;
    if (!room.drawing?.length) return;

    room.undoStack ??= [];

    const stroke = room.drawing.pop();
    room.undoStack.push(stroke);

    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  /* =========================
     REDO (drawer only)
  ========================== */
  socket.on("REDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.drawerId !== socket.userId) return;
    if (!room.undoStack?.length) return;

    const stroke = room.undoStack.pop();
    room.drawing.push(stroke);

    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  /* =========================
     DRAW SYNC (reconnect)
  ========================== */
  socket.on("REQUEST_DRAW_SYNC", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;

    socket.emit("DRAW_SYNC", room.drawing ?? []);
  });
};
