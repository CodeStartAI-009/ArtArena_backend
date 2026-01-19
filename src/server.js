// src/server.js
require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const setupSockets = require("./sockets");

const PORT = process.env.PORT || 5090;

/* ===============================
   CONNECT DATABASE
================================ */
connectDB();

/* ===============================
   CREATE HTTP SERVER
================================ */
const server = http.createServer(app);

/* ===============================
   ATTACH SOCKET.IO (CRITICAL)
================================ */
setupSockets(server);

/* ===============================
   START SERVER
================================ */
server.listen(PORT, () => {
  console.log(`🚀 ArtArena backend running on port ${PORT}`);
});
