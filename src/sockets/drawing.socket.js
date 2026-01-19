// backend/src/sockets/drawing.socket.js

module.exports = (io, socket, rooms) => {

  /* ================= DRAW ================= */
  socket.on("DRAW", ({ code, x, y, prevX, prevY }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.drawerId !== socket.userId) return;
  
    const now = Date.now();
  
    // =========================
    // FIRST DRAW DETECTED
    // =========================
    if (!room.drawStartedAt) {
      room.drawStartedAt = now;
  
      // Cancel 10s no-draw timer
      if (room.noDrawTimer) {
        clearTimeout(room.noDrawTimer);
        room.noDrawTimer = null;
      }
    }
  
    // =========================
    // DRAW IDLE RESET (5s)
    // =========================
    room.lastDrawAt = now;
  
    if (room.drawIdleTimer) {
      clearTimeout(room.drawIdleTimer);
    }
  
    room.drawIdleTimer = setTimeout(() => {
      if (!room.guessingAllowed && room.status === "playing") {
        console.log("✋ Drawer idle 5s → auto allow guessing");
        const { allowGuessing } = require("../engine/roundEngine");
        allowGuessing(io, room);
      }
    }, 5_000);
  
    // =========================
    // NORMAL DRAW LOGIC
    // =========================
    const stroke = { x, y, prevX, prevY };
    room.drawing.push(stroke);
    room.undoStack = [];
  
    socket.to(code).emit("DRAW", stroke);
  });
  
  /* ================= UNDO ================= */
  socket.on("UNDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.drawerId !== socket.userId) return;
    if (!room.drawing.length) return;

    const lastStroke = room.drawing.pop();
    room.undoStack.push(lastStroke);

    // 🔥 Force full redraw
    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  /* ================= REDO ================= */
  socket.on("REDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.drawerId !== socket.userId) return;
    if (!room.undoStack.length) return;

    const stroke = room.undoStack.pop();
    room.drawing.push(stroke);

    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  /* ================= SYNC ================= */
  socket.on("REQUEST_DRAW_SYNC", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;

    socket.emit("DRAW_SYNC", room.drawing);
  });
};
