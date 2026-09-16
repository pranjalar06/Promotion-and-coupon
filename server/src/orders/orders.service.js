const prisma = require("../database/prisma");
const AppError = require("../utils/AppError");
const { log } = require("../utils/logger");
const { toDecimal } = require("../utils/money");
const { calculatePricing } = require("../pricing/pricingEngine");
const promotionEngine = require("../promotions/promotionEngine");
const { normalizePromotion } = require("../promotions/promotions.mapper");
const { serializeOrder } = require("./orders.mapper");

// Reserves an idempotency key up-front (outside the main transaction) so that
// concurrent/duplicate submissions of the same checkout request cannot both proceed.
async function claimIdempotencyKey(key, userId) {
  if (!key) return { claimed: true, existing: null };
  try {
    await prisma.idempotencyKey.create({ data: { key, userId } });
    return { claimed: true, existing: null };
  } catch (err) {
    if (err.code === "P2002") {
      const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
      return { claimed: false, existing };
    }
    throw err;
  }
}

async function storeIdempotencyResponse(key, orderId, response) {
  if (!key) return;
  await prisma.idempotencyKey.update({ where: { key }, data: { orderId, response } });
}

// On a business-validation failure (as opposed to a simulated payment failure,
// which is a legitimate cached outcome) the claim is released so the client can
// safely retry with the same key once the underlying issue is fixed.
async function releaseIdempotencyKey(key) {
  if (!key) return;
  try {
    await prisma.idempotencyKey.delete({ where: { key } });
  } catch (err) {
    if (err.code !== "P2025") throw err;
  }
}

function buildLineItemsFromFreshProducts(cartItems, products) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return cartItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.active || !product.category || !product.category.active) {
      throw new AppError(409, "PRODUCT_OUT_OF_STOCK", `${item.product.name} is no longer available.`);
    }
    const unitPrice = toDecimal(product.price);
    return {
      cartItemId: item.id,
      productId: product.id,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      productName: product.name,
      sku: product.sku,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice.times(item.quantity),
      requiredStock: item.quantity,
    };
  });
}

/**
 * Final, authoritative checkout. Re-validates everything server-side; the
 * cart/pricing previously displayed to the client is never trusted.
 *
 * There is no real payment gateway: exactly two outcomes exist,
 * paymentOutcome "SUCCESS" (order placed, coupon redeemed, stock reserved)
 * and "FAILED" (a full no-op — nothing is written except idempotency
 * bookkeeping). Customer identity comes from the authenticated user, never
 * from the request body, so there is no separate checkout form to fill in —
 * both outcome buttons are clickable immediately.
 */
async function checkout(user, payload) {
  const userId = user.id;
  const { paymentOutcome, idempotencyKey } = payload;
  if (paymentOutcome !== "SUCCESS" && paymentOutcome !== "FAILED") {
    throw new AppError(422, "VALIDATION_ERROR", "A payment outcome must be provided.");
  }

  const claim = await claimIdempotencyKey(idempotencyKey, userId);
  if (!claim.claimed) {
    if (claim.existing && claim.existing.response) {
      log("order.checkout.idempotent_replay", { userId, idempotencyKey });
      return claim.existing.response;
    }
    throw new AppError(409, "DUPLICATE_REQUEST", "This request is already being processed. Please wait.");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: { include: { category: true } } } } },
  });

  if (!cart || cart.items.length === 0) {
    await releaseIdempotencyKey(idempotencyKey);
    throw new AppError(422, "CART_EMPTY", "Your cart is empty.");
  }

  if (paymentOutcome === "FAILED") {
    log("payment.simulated.failure", { userId, cartId: cart.id });
    const response = { paymentStatus: "FAILED", order: null };
    await storeIdempotencyResponse(idempotencyKey, null, response);
    return response;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const freshCart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: { include: { category: true } } } } },
      });
      if (!freshCart || freshCart.items.length === 0) {
        throw new AppError(422, "CART_EMPTY", "Your cart is empty.");
      }

      const productIds = freshCart.items.map((i) => i.productId);
      const freshProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { category: true },
      });
      const lineItems = buildLineItemsFromFreshProducts(freshCart.items, freshProducts);

      let promotionEval = null;
      let promotionRow = null;
      if (freshCart.couponCode) {
        // Lock the promotion row for the lifetime of this transaction so concurrent
        // checkouts against the same coupon (e.g. its last remaining use) serialize.
        const locked = await tx.$queryRaw`SELECT id FROM promotions WHERE code = ${freshCart.couponCode} FOR UPDATE`;
        if (locked.length === 0) {
          throw new AppError(422, "PROMOTION_NOT_FOUND", "This coupon code does not exist.");
        }
        promotionRow = await tx.promotion.findUnique({
          where: { id: locked[0].id },
          include: { categories: true },
        });
        const userRedemptionCount = await tx.redemption.count({
          where: { promotionId: promotionRow.id, userId },
        });
        const result = promotionEngine.evaluatePromotion(normalizePromotion(promotionRow), {
          cartItems: lineItems,
          now: new Date(),
          userRedemptionCount,
        });
        if (!result.ok) {
          throw new AppError(422, result.code, result.message, result.data);
        }
        promotionEval = result;
      }

      const pricing = calculatePricing(lineItems, promotionEval);

      // Atomically reserve stock: fails the WHERE clause (and thus updates 0 rows)
      // if another concurrent order already consumed the remaining stock.
      for (const item of lineItems) {
        const updateResult = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.requiredStock } },
          data: { stock: { decrement: item.requiredStock } },
        });
        if (updateResult.count === 0) {
          throw new AppError(409, "PRODUCT_OUT_OF_STOCK", `${item.productName} no longer has enough stock.`);
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          userId,
          subtotal: pricing.subtotal.toFixed(2),
          discount: pricing.discount.toFixed(2),
          total: pricing.total.toFixed(2),
          couponCode: promotionEval ? promotionEval.promotion.code : null,
          customerName: user.name,
          customerEmail: user.email,
          customerAddress: (payload.customerAddress || "").trim(),
          status: "COMPLETED",
          paymentStatus: "SUCCESS",
          items: {
            create: pricing.lineAllocations.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              sku: line.sku,
              categoryName: line.categoryName,
              quantity: line.quantity,
              unitPrice: line.unitPrice.toFixed(2),
              discount: line.discount.toFixed(2),
              finalPrice: line.finalPrice.toFixed(2),
            })),
          },
        },
        include: { items: true },
      });

      if (promotionEval) {
        // Re-check the limit using the row we hold locked, then increment usage
        // and record a redemption snapshot in the same transaction as the order.
        if (
          promotionRow.totalUsageLimit != null &&
          promotionRow.currentUsage >= promotionRow.totalUsageLimit
        ) {
          throw new AppError(422, "TOTAL_USAGE_LIMIT_REACHED", "This coupon has reached its total usage limit.");
        }
        await tx.promotion.update({
          where: { id: promotionRow.id },
          data: { currentUsage: { increment: 1 } },
        });
        await tx.redemption.create({
          data: {
            promotionId: promotionRow.id,
            userId,
            orderId: createdOrder.id,
            couponCode: promotionRow.code,
            discountType: promotionRow.discountType,
            discountValue: promotionRow.discountValue,
            discountAmount: pricing.discount.toFixed(2),
          },
        });
        log("coupon.redeem.success", { userId, promotionId: promotionRow.id, orderId: createdOrder.id });
      }

      await tx.cartItem.deleteMany({ where: { cartId: freshCart.id } });
      await tx.cart.update({ where: { id: freshCart.id }, data: { couponCode: null } });

      return createdOrder;
    });

    log("order.created", { userId, orderId: order.id });
    log("payment.simulated.success", { userId, orderId: order.id });

    const response = { paymentStatus: "SUCCESS", order: serializeOrder(order) };
    await storeIdempotencyResponse(idempotencyKey, order.id, response);
    return response;
  } catch (err) {
    log("order.failed", { userId, code: err.code, message: err.message });
    await releaseIdempotencyKey(idempotencyKey);
    throw err;
  }
}

async function listOrders(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return orders.map(serializeOrder);
}

async function getOrder(orderId, userId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  if (order.userId !== userId) throw new AppError(403, "ORDER_ACCESS_DENIED", "You do not have access to this order.");
  return serializeOrder(order);
}

module.exports = { checkout, listOrders, getOrder };
