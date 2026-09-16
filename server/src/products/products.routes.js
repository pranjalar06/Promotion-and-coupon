const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const productsService = require("./products.service");

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const products = await productsService.listProducts({ categorySlug: req.query.category });
    res.json({ products });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await productsService.getProductById(req.params.id);
    res.json({ product });
  })
);

module.exports = router;
