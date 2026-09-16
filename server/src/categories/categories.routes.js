const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const categoriesService = require("./categories.service");

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await categoriesService.listActiveCategories();
    res.json({ categories });
  })
);

module.exports = router;
