const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { generateGuestName } = require("../services/username.service");

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
   REFERRAL CODE GENERATOR
========================= */
const generateReferralCode = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();

/* =========================
   CREATE UNIQUE GUEST NAME
========================= */
async function createUniqueGuestName() {
  let username;
  let exists = true;

  while (exists) {
    username = generateGuestName();
    exists = await User.exists({ username });
  }

  return username;
}

/* =========================
   GUEST LOGIN  ✅ FIXED
========================= */
exports.guestLogin = async (req, res) => {
  try {
    const guestId = req.headers["x-guest-id"];
    const { referralCode } = req.body;

    /* ---------- REUSE EXISTING GUEST ---------- */
    if (guestId) {
      const existing = await User.findById(guestId);

      if (existing && existing.isGuest) {
        // 🔥 ENSURE REFERRAL CODE EXISTS
        if (!existing.referralCode) {
          existing.referralCode = generateReferralCode();
          await existing.save();
        }

        return res.json({
          user: existing,
          token: createToken(existing),
        });
      }
    }

    /* ---------- CREATE NEW GUEST ---------- */
    const guestUsername = await createUniqueGuestName();

    const guest = await User.create({
      isGuest: true,
      username: guestUsername,
      coins: 100,
      gems: 50,
      xp: 0,
      level: 1,

      // 🔗 REFERRAL SYSTEM
      referralCode: generateReferralCode(), // 🔥 THIS WAS MISSING
      referredBy: referralCode || null,
      referralRewarded: false,
    });

    /* ---------- 🔥 INSTANT REFERRAL REWARD ---------- */
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });

      if (referrer && !guest.referralRewarded) {
        referrer.coins += 100;
        await referrer.save();

        guest.referralRewarded = true;
        await guest.save();
      }
    }

    return res.json({
      user: guest,
      token: createToken(guest),
    });
  } catch (err) {
    console.error("Guest login error:", err);
    return res.status(500).json({ message: "Guest login failed" });
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

        // 🔗 Ensure referral code exists
        if (!guest.referralCode) {
          guest.referralCode = generateReferralCode();
        }

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
      referralCode: generateReferralCode(),
    });

    return res.json({
      user,
      token: createToken(user),
    });
  } catch (err) {
    console.error("Email auth error:", err);
    return res.status(500).json({ message: "Authentication failed" });
  }
};

/* =========================
   GET CURRENT USER
========================= */
exports.getMe = (req, res) => {
  return res.json({ user: req.user });
};
