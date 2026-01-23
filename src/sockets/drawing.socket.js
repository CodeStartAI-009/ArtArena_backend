 // backend/src/sockets/drawing.socket.js

module.exports = (io, socket, rooms) => {

  /* =========================
     DRAW
  ========================== */
  socket.on("DRAW", ({ code, x, y, prevX, prevY }) => {
    const room = rooms.get(code);
    if (!room || room.status !== "playing") return;

    const player = room.players.find(p => p.id === socket.userId);
    if (!player) return;

    // Guard invalid strokes
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof prevX !== "number" ||
      typeof prevY !== "number"
    ) {
      return;
    }

    /* =========================
       TOGETHER MODE (2 PLAYERS)
    ========================== */
    
    if (room.mode === "Together" && room.gameplay === "Drawing") {
      if (!player.side) return;

      // Canvas width = 800 → split at 400
      if (player.side === "left" && x > 400) return;
      if (player.side === "right" && x < 400) return;

      const stroke = {
        x,
        y,
        prevX,
        prevY,
        side: player.side,
      };

      room.drawing.push(stroke);
      io.to(code).emit("DRAW", stroke);
      return;
    }

    /* =========================
       TOGETHER → OPEN CANVAS
    ========================== */
    if (room.mode === "Together" && room.gameplay === "Open-canvas") {
      const stroke = { x, y, prevX, prevY };

      room.drawing.push(stroke);
      io.to(code).emit("DRAW", stroke);
      return;
    }
    /* =========================
       CLASSIC / QUICK / KIDS
    ========================== */
    if (room.drawerId !== socket.userId) return;

    const now = Date.now();

    /* ---------- First draw detection ---------- */
    if (!room.drawStartedAt) {
      room.drawStartedAt = now;

      if (room.noDrawTimer) {
        clearTimeout(room.noDrawTimer);
        room.noDrawTimer = null;
      }
    }

    /* ---------- Idle detection (5s) ---------- */
    room.lastDrawAt = now;

    if (room.drawIdleTimer) {
      clearTimeout(room.drawIdleTimer);
    }

    room.drawIdleTimer = setTimeout(() => {
      if (!room.guessingAllowed && room.status === "playing") {
        const { allowGuessing } = require("../engine/roundEngine");
        allowGuessing(io, room);
      }
    }, 5_000);

    const stroke = { x, y, prevX, prevY };
    room.drawing.push(stroke);
    room.undoStack = [];

    socket.to(code).emit("DRAW", stroke);
  });

  /* =========================
     UNDO (NOT TOGETHER)
  ========================== */
  socket.on("UNDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.mode === "Together") return;
    if (room.drawerId !== socket.userId) return;
    if (!room.drawing.length) return;

    const stroke = room.drawing.pop();
    room.undoStack.push(stroke);

    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  /* =========================
     REDO (NOT TOGETHER)
  ========================== */
  socket.on("REDO", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.mode === "Together") return;
    if (room.drawerId !== socket.userId) return;
    if (!room.undoStack.length) return;

    const stroke = room.undoStack.pop();
    room.drawing.push(stroke);

    io.to(code).emit("DRAW_SYNC", room.drawing);
  });

  /* =========================
     DRAW SYNC (REJOIN)
  ========================== */
  socket.on("REQUEST_DRAW_SYNC", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;

    socket.emit("DRAW_SYNC", room.drawing ?? []);
  });
};
