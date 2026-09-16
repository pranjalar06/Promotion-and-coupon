const prisma = require("../database/prisma");
const AppError = require("../utils/AppError");
const { log } = require("../utils/logger");
const { buildLineItems, serializePricing } = require("./carts.mapper");
const { calculatePricing } = require("../pricing/pricingEngine");
const promotionsService = require("../promotions/promotions.service");
const { serializePromotionSummary } = require("../promotions/promotions.mapper");

const CART_INCLUDE = { items: { include: { product: { include: { category: true } } } } };

async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId }, include: CART_INCLUDE });
  }
  return cart;
}

async function loadOwnedCart(cartId, userId) {
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE });
  if (!cart) throw new AppError(404, "CART_NOT_FOUND", "Cart not found.");
  if (cart.userId !== userId) throw new AppError(403, "CART_ACCESS_DENIED", "You do not have access to this cart.");
  return cart;
}

async function validateProductForCart(productId, requestedQuantity) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product || !product.active) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "This product is not available.");
  }
  if (!product.category || !product.category.active) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "This product is not available.");
  }
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
    throw new AppError(422, "VALIDATION_ERROR", "Quantity must be a positive whole number.");
  }
  if (product.stock < requestedQuantity) {
    throw new AppError(409, "PRODUCT_OUT_OF_STOCK", `Only ${product.stock} unit(s) of ${product.name} left in stock.`, {
      available: product.stock,
    });
  }
  return product;
}

async function addItem(cartId, userId, { productId, quantity }) {
  await loadOwnedCart(cartId, userId);
  const qty = Number(quantity);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });
  const totalRequested = (existing ? existing.quantity : 0) + qty;
  await validateProductForCart(productId, totalRequested);

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: totalRequested } });
  } else {
    await validateProductForCart(productId, qty);
    await prisma.cartItem.create({ data: { cartId, productId, quantity: qty } });
  }

  return loadOwnedCart(cartId, userId);
}

async function updateItem(cartId, userId, itemId, { quantity }) {
  const cart = await loadOwnedCart(cartId, userId);
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw new AppError(404, "CART_ITEM_NOT_FOUND", "Cart item not found.");

  const qty = Number(quantity);
  await validateProductForCart(item.productId, qty);
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: qty } });
  return loadOwnedCart(cartId, userId);
}

async function removeItem(cartId, userId, itemId) {
  const cart = await loadOwnedCart(cartId, userId);
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw new AppError(404, "CART_ITEM_NOT_FOUND", "Cart item not found.");
  await prisma.cartItem.delete({ where: { id: itemId } });
  return loadOwnedCart(cartId, userId);
}

// Computes full pricing for a cart, re-evaluating its persisted coupon (if any)
// fresh against current cart contents. This is the single source of truth used
// by GET pricing, coupon apply/remove, and rendered on the cart page.
async function computePricing(cart, userId) {
  const lineItems = buildLineItems(cart);

  if (!cart.couponCode) {
    const pricing = calculatePricing(lineItems, null);
    return { pricing, appliedCoupon: null, rejection: null };
  }

  const { result } = await promotionsService.evaluateCoupon({
    code: cart.couponCode,
    lineItems,
    userId,
    now: new Date(),
  });

  if (!result.ok) {
    // Coupon no longer applies (expired, exhausted, cart changed). Pricing falls
    // back to no-discount, and the caller is informed via `rejection`.
    const pricing = calculatePricing(lineItems, null);
    return { pricing, appliedCoupon: null, rejection: result };
  }

  const pricing = calculatePricing(lineItems, result);
  return { pricing, appliedCoupon: serializePromotionSummary(result.promotion), rejection: null };
}

async function getPricing(cartId, userId) {
  const cart = await loadOwnedCart(cartId, userId);
  const { pricing, appliedCoupon } = await computePricing(cart, userId);
  return serializePricing(pricing, appliedCoupon);
}

async function applyCoupon(cartId, userId, code) {
  const cart = await loadOwnedCart(cartId, userId);
  if (!code || !code.trim()) {
    throw new AppError(422, "VALIDATION_ERROR", "Please enter a coupon code.");
  }

  const lineItems = buildLineItems(cart);
  const { result } = await promotionsService.evaluateCoupon({
    code,
    lineItems,
    userId,
    now: new Date(),
  });

  if (!result.ok) {
    log("coupon.apply.rejected", { userId, code, reason: result.code });
    throw new AppError(422, result.code, result.message, result.data);
  }

  await prisma.cart.update({ where: { id: cartId }, data: { couponCode: result.promotion.code } });
  log("coupon.apply.success", { userId, code: result.promotion.code });

  const pricing = calculatePricing(lineItems, result);
  return serializePricing(pricing, serializePromotionSummary(result.promotion));
}

async function removeCoupon(cartId, userId, code) {
  const cart = await loadOwnedCart(cartId, userId);
  if (cart.couponCode && code && cart.couponCode.toUpperCase() !== code.trim().toUpperCase()) {
    throw new AppError(404, "COUPON_NOT_APPLIED", "This coupon is not applied to your cart.");
  }
  await prisma.cart.update({ where: { id: cartId }, data: { couponCode: null } });

  const refreshed = await loadOwnedCart(cartId, userId);
  const lineItems = buildLineItems(refreshed);
  const pricing = calculatePricing(lineItems, null);
  return serializePricing(pricing, null);
}

function serializeCart(cart, pricingResponse) {
  return {
    id: cart.id,
    items: pricingResponse.items,
    subtotal: pricingResponse.subtotal,
    eligibleSubtotal: pricingResponse.eligibleSubtotal,
    discount: pricingResponse.discount,
    total: pricingResponse.total,
    coupon: pricingResponse.coupon,
  };
}

async function getCart(cartId, userId) {
  const cart = await loadOwnedCart(cartId, userId);
  const { pricing, appliedCoupon } = await computePricing(cart, userId);
  const pricingResponse = serializePricing(pricing, appliedCoupon);
  return serializeCart(cart, pricingResponse);
}

module.exports = {
  getOrCreateCart,
  loadOwnedCart,
  addItem,
  updateItem,
  removeItem,
  getPricing,
  applyCoupon,
  removeCoupon,
  getCart,
  computePricing,
};
