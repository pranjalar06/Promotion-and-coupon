const asyncHandler = require("../utils/asyncHandler");
const ordersService = require("./orders.service");

const checkout = asyncHandler(async (req, res) => {
  const result = await ordersService.checkout(req.user.id, req.body || {});
  res.status(result.paymentStatus === "SUCCESS" ? 201 : 200).json(result);
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await ordersService.listOrders(req.user.id);
  res.json({ orders });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await ordersService.getOrder(req.params.id, req.user.id);
  res.json({ order });
});

module.exports = { checkout, listOrders, getOrder };
