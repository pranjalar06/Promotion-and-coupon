const asyncHandler = require("../utils/asyncHandler");
const cartsService = require("./carts.service");

const getMyCart = asyncHandler(async (req, res) => {
  const owned = await cartsService.getOrCreateCart(req.user.id);
  const cart = await cartsService.getCart(owned.id, req.user.id);
  res.json({ cart });
});

const getCart = asyncHandler(async (req, res) => {
  const cart = await cartsService.getCart(req.params.id, req.user.id);
  res.json({ cart });
});

const addItem = asyncHandler(async (req, res) => {
  await cartsService.addItem(req.params.id, req.user.id, req.body || {});
  const cart = await cartsService.getCart(req.params.id, req.user.id);
  res.status(201).json({ cart });
});

const updateItem = asyncHandler(async (req, res) => {
  await cartsService.updateItem(req.params.id, req.user.id, req.params.itemId, req.body || {});
  const cart = await cartsService.getCart(req.params.id, req.user.id);
  res.json({ cart });
});

const removeItem = asyncHandler(async (req, res) => {
  await cartsService.removeItem(req.params.id, req.user.id, req.params.itemId);
  const cart = await cartsService.getCart(req.params.id, req.user.id);
  res.json({ cart });
});

const getPricing = asyncHandler(async (req, res) => {
  const pricing = await cartsService.getPricing(req.params.id, req.user.id);
  res.json(pricing);
});

const applyCoupon = asyncHandler(async (req, res) => {
  const pricing = await cartsService.applyCoupon(req.params.id, req.user.id, (req.body || {}).code);
  res.json(pricing);
});

const removeCoupon = asyncHandler(async (req, res) => {
  const pricing = await cartsService.removeCoupon(req.params.id, req.user.id, req.params.code);
  res.json(pricing);
});

module.exports = { getMyCart, getCart, addItem, updateItem, removeItem, getPricing, applyCoupon, removeCoupon };
