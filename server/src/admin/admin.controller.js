const asyncHandler = require("../utils/asyncHandler");
const dashboardService = require("./dashboard.admin.service");
const promotionsService = require("./promotions.admin.service");
const categoriesService = require("../categories/categories.service");
const prisma = require("../database/prisma");
const { toMoneyString } = require("../utils/money");

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard();
  res.json({ dashboard });
});

const listPromotions = asyncHandler(async (req, res) => {
  const promotions = await promotionsService.listPromotions();
  res.json({ promotions });
});

const getPromotion = asyncHandler(async (req, res) => {
  const promotion = await promotionsService.getPromotionDetail(req.params.id);
  res.json({ promotion });
});

const createPromotion = asyncHandler(async (req, res) => {
  const promotion = await promotionsService.createPromotion(req.body || {});
  res.status(201).json({ promotion });
});

const updatePromotion = asyncHandler(async (req, res) => {
  const promotion = await promotionsService.updatePromotion(req.params.id, req.body || {});
  res.json({ promotion });
});

const pausePromotion = asyncHandler(async (req, res) => {
  const promotion = await promotionsService.setStatus(req.params.id, "PAUSED");
  res.json({ promotion });
});

const activatePromotion = asyncHandler(async (req, res) => {
  const promotion = await promotionsService.setStatus(req.params.id, "ACTIVE");
  res.json({ promotion });
});

const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoriesService.listAllCategories();
  res.json({ categories });
});

const listProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } });
  res.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: toMoneyString(p.price),
      stock: p.stock,
      active: p.active,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
    })),
  });
});

module.exports = {
  getDashboard,
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  pausePromotion,
  activatePromotion,
  listCategories,
  listProducts,
};
