const router = require("express").Router();
const { protect } = require("../middlewares/auth.middleware");
const userController = require("../controllers/user.controller");

/**
 * GET current user profile
 */
router.get("/me", protect, userController.getMe);

module.exports = router;
