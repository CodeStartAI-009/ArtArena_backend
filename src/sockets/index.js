// backend/src/sockets/index.js

const { Server } = require("socket.io");

const lobbySocket = require("./room.socket");
const gameSocket = require("./game.socket");
const drawingSocket = require("./drawing.socket");

const rooms = new Map();

module.exports = function setupSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "https://art-arena-frontend.vercel.app",
      ],
      credentials: true,
    },
  });

  console.log("🔌 Socket.IO initialized");

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    /* =========================
       AUTH (REQUIRED)
    ========================== */
    socket.on("AUTH", ({ userId }) => {
      if (!userId) return;
    
      // ✅ store in BOTH places
      socket.data.userId = String(userId);
      socket.userId = String(userId); // fallback
    
      console.log("🔐 AUTH success →", socket.data.userId);
      socket.emit("AUTH_SUCCESS");
    });
    

    /* =========================
       REGISTER SOCKET MODULES
    ========================== */
    lobbySocket(io, socket, rooms);
    gameSocket(io, socket, rooms);
    drawingSocket(io, socket, rooms);

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });
};
