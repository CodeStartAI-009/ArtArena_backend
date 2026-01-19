const router = require("express").Router();
const passport = require("passport");
const auth = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");

router.post("/guest", auth.guestLogin);
router.post("/email", auth.emailSignup);
router.get(
  "/google",
  (req, res, next) => {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state: req.query.guestId || "", // ✅ optional
    })(req, res, next);
  }
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    res.redirect(
      `https://art-arena-frontend.vercel.app/`
    );
  }
);



router.get("/me", protect, auth.getMe);

module.exports = router;
