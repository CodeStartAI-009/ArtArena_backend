// src/app.js
const express = require("express");
const cors = require("cors");
const passport = require("./config/passport");

/* ===============================
   ROUTES
================================ */
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const roomRoutes = require("./routes/room.routes");
const gameRoutes = require("./routes/game.routes");

const app = express();

/* ===============================
   MIDDLEWARE
================================ */

/* ✅ CORS — FRONTEND SAFE */
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

/* ✅ JSON BODY PARSER */
app.use(express.json());

/* ✅ PASSPORT INIT */
app.use(passport.initialize());

/* ===============================
   API ROUTES
================================ */
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/rooms", roomRoutes);
app.use("/game", gameRoutes);

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "ArtArena API",
    version: "1.0.0",
  });
});

module.exports = app;
