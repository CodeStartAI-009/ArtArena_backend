const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const createToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:5090/auth/google/callback",
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const guestId = req.query.state || null;

        /* =========================
           CASE 1: EMAIL ALREADY EXISTS → LOGIN
        ========================= */
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          // ❌ NEVER upgrade guest in this case
          if (guestId) {
            await User.deleteOne({ _id: guestId }); // 🔥 cleanup
          }

          return done(null, {
            token: createToken(existingUser),
          });
        }

        /* =========================
           CASE 2: UPGRADE GUEST
        ========================= */
        if (guestId) {
          const guest = await User.findById(guestId);

          if (guest && guest.isGuest) {
            guest.email = email;
            guest.username = name;
            guest.isGuest = false;
            guest.coins += 200;

            await guest.save();

            return done(null, {
              token: createToken(guest),
            });
          }
        }

        /* =========================
           CASE 3: BRAND NEW USER
        ========================= */
        const user = await User.create({
          email,
          username: name,
          isGuest: false,
          coins: 200,
          level: 1,
          xp: 0,
          gems: 0,
        });

        return done(null, {
          token: createToken(user),
        });
      } catch (err) {
        done(err);
      }
    }
  )
);

module.exports = passport;
