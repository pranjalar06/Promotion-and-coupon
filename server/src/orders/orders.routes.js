const { Router } = require("express");
const controller = require("./orders.controller");
const { authenticate } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.post("/checkout", controller.checkout);
router.get("/", controller.listOrders);
router.get("/:id", controller.getOrder);

module.exports = router;
