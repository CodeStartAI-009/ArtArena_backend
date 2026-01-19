const jwt = require("jsonwebtoken");
const User = require("../models/User");

const createToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

exports.guestLogin = async (req, res) => {
  try {
    const guestId = req.headers["x-guest-id"];

    if (guestId) {
      const guest = await User.findById(guestId);
      if (guest && guest.isGuest) {
        return res.json({ user: guest, token: createToken(guest) });
      }
    }

    const guest = await User.create({
      isGuest: true,
      username: `Guest_${Math.floor(Math.random() * 1e6)}`,
      level: 1,
      xp: 0,
      coins: 100,
      gems: 50,
    });

    res.json({ user: guest, token: createToken(guest) });
  } catch {
    res.status(500).json({ message: "Guest login failed" });
  }
};
exports.emailSignup = async (req, res) => {
  const { email, username, password } = req.body;
  const guestId = req.headers["x-guest-id"];

  /* =========================
     EMAIL EXISTS → LOGIN
  ========================= */
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (guestId) {
      await User.deleteOne({ _id: guestId }); // 🔥 cleanup guest
    }

    return res.json({
      user: existingUser,
      token: createToken(existingUser),
    });
  }

  /* =========================
     UPGRADE GUEST
  ========================= */
  if (guestId) {
    const guest = await User.findById(guestId);
    if (guest && guest.isGuest) {
      guest.email = email;
      guest.username = username;
      guest.passwordHash = password;
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
     NEW USER
  ========================= */
  const user = await User.create({
    email,
    username,
    passwordHash: password,
    isGuest: false,
    coins: 300,
    level: 1,
    xp: 0,
    gems: 100,
  });

  res.json({
    user,
    token: createToken(user),
  });
};


exports.getMe = (req, res) => {
  res.json({ user: req.user });
};
