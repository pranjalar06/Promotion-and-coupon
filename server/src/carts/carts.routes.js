const { Router } = require("express");
const controller = require("./carts.controller");
const { authenticate } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.get("/me", controller.getMyCart);
router.get("/:id", controller.getCart);
router.post("/:id/items", controller.addItem);
router.patch("/:id/items/:itemId", controller.updateItem);
router.delete("/:id/items/:itemId", controller.removeItem);

router.get("/:id/pricing", controller.getPricing);
router.get("/:id/coupons/available", controller.listAvailableCoupons);
router.post("/:id/coupons", controller.applyCoupon);
router.delete("/:id/coupons/:code", controller.removeCoupon);

module.exports = router;
