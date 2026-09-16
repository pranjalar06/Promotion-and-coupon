const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/auth");
const promotionsService = require("./promotions.service");

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const promotions = await promotionsService.listAvailablePromotions();
    res.json({ promotions });
  })
);

module.exports = router;
