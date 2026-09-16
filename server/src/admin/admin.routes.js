const { Router } = require("express");
const controller = require("./admin.controller");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate, requireRole("ADMIN"));

router.get("/dashboard", controller.getDashboard);

router.get("/promotions", controller.listPromotions);
router.get("/promotions/:id", controller.getPromotion);
router.post("/promotions", controller.createPromotion);
router.patch("/promotions/:id", controller.updatePromotion);
router.post("/promotions/:id/pause", controller.pausePromotion);
router.post("/promotions/:id/activate", controller.activatePromotion);

router.get("/categories", controller.listCategories);
router.get("/products", controller.listProducts);

module.exports = router;
