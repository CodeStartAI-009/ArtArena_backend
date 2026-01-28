const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* =========================
   TOKEN HELPER
========================= */
const createToken = (user) => {
  return jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* =========================
   GUEST LOGIN
========================= */
exports.guestLogin = async (req, res) => {
  try {
    const guestId = req.headers["x-guest-id"];

    /* ---------- REUSE EXISTING GUEST ---------- */
    if (guestId) {
      const existing = await User.findById(guestId);
      if (existing && existing.isGuest) {
        return res.json({
          user: existing,
          token: createToken(existing),
        });
      }
    }

    /* ---------- CREATE NEW GUEST ---------- */
    const guest = await User.create({
      isGuest: true,
      username: `Guest_${Math.floor(Math.random() * 1e6)}`,
      coins: 100,
      gems: 50,
      xp: 0,
      level: 1,
    });

    return res.json({
      user: guest,
      token: createToken(guest),
    });
  } catch (err) {
    console.error("Guest login error:", err);
    res.status(500).json({ message: "Guest login failed" });
  }
};

/* =========================
   EMAIL SIGNUP / LOGIN
========================= */
exports.emailSignup = async (req, res) => {
  try {
    const { email, username } = req.body;
    const guestId = req.headers["x-guest-id"];

    if (!email || !username) {
      return res
        .status(400)
        .json({ message: "Email and username required" });
    }

    /* =========================
       CASE 1: EMAIL EXISTS → LOGIN
    ========================== */
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // 🔥 Cleanup guest if exists
      if (guestId) {
        await User.deleteOne({ _id: guestId }).catch(() => {});
      }

      return res.json({
        user: existingUser,
        token: createToken(existingUser),
      });
    }

    /* =========================
       CASE 2: UPGRADE GUEST → EMAIL USER
    ========================== */
    if (guestId) {
      const guest = await User.findById(guestId);

      if (guest && guest.isGuest) {
        guest.email = email;
        guest.username = username;
        guest.isGuest = false;
        guest.coins += 300;
        guest.gems += 100;

        await guest.save();

        return res.json({
          user: guest,
          token: createToken(guest),
        });
      }
    }

    /* =========================
       CASE 3: NEW EMAIL USER
    ========================== */
    const user = await User.create({
      email,
      username,
      isGuest: false,
      coins: 300,
      gems: 100,
      xp: 0,
      level: 1,
    });

    return res.json({
      user,
      token: createToken(user),
    });
  } catch (err) {
    console.error("Email auth error:", err);
    res.status(500).json({ message: "Authentication failed" });
  }
};

/* =========================
   GET CURRENT USER
========================= */
exports.getMe = (req, res) => {
  return res.json({ user: req.user });
};
