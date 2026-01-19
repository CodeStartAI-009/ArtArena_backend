const router = require("express").Router();
const { protect } = require("../middlewares/auth.middleware");
const controller = require("../controllers/room.controller");

router.post("/", protect, controller.createRoom);
router.get("/:code", controller.getRoom);
router.post("/:code/join", protect, controller.joinRoom);

module.exports = router;
