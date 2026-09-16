const { Router } = require("express");
const controller = require("./auth.controller");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.post("/signup", controller.signup);
router.post("/login", controller.login);
router.get("/me", authenticate, controller.me);

module.exports = router;
