// backend/src/sockets/index.js
const { Server } = require("socket.io");

const lobbySocket = require("./room.socket");
const gameSocket = require("./game.socket");
const drawingSocket = require("./drawing.socket");

const rooms = new Map();

module.exports = function setupSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: "https://art-arena-frontend.vercel.app/",
      credentials: true,
    },
  });

  console.log("🔌 Socket.IO initialized");

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    /* =========================
       AUTH (REQUIRED)
    ========================== */
    socket.on("AUTH", ({ userId, username }) => {
      socket.userId = userId;
      socket.username = username;
    
      console.log(`🔐 AUTH success → ${userId} (${username})`);
    
      socket.emit("AUTH_SUCCESS"); // 🔥 REQUIRED
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
