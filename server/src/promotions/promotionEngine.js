const { Decimal } = require("../utils/money");

// Pure, DB-independent promotion evaluation logic.
// Answers exactly one question: "does this promotion apply, and to what?"
// It never calculates discount amounts — that is the pricing engine's job.

const CODES = {
  NOT_FOUND: "PROMOTION_NOT_FOUND",
  INACTIVE: "PROMOTION_INACTIVE",
  NOT_STARTED: "PROMOTION_NOT_STARTED",
  EXPIRED: "PROMOTION_EXPIRED",
  MIN_ORDER: "MIN_ORDER_VALUE_NOT_MET",
  NO_ELIGIBLE_ITEMS: "NO_ELIGIBLE_ITEMS",
  CUSTOMER_LIMIT: "CUSTOMER_LIMIT_REACHED",
  TOTAL_LIMIT: "TOTAL_USAGE_LIMIT_REACHED",
  EMPTY_CART: "CART_EMPTY",
};

function fail(code, message, data) {
  return { ok: false, code, message, data };
}

function isCategoryEligible(promotion, categoryId) {
  if (promotion.appliesToAllCategories) return true;
  return promotion.categoryIds.includes(categoryId);
}

function sumLineTotals(items) {
  return items.reduce((sum, item) => sum.plus(item.lineTotal), new Decimal(0));
}

/**
 * @param {object|null} promotion - normalized promotion: { status, startAt, endAt, appliesToAllCategories,
 *   categoryIds, minimumOrderValue, perUserUsageLimit, totalUsageLimit, currentUsage, discountType, discountValue, maximumDiscount, code }
 * @param {object} ctx - { cartItems: [{productId, categoryId, lineTotal: Decimal}], now: Date, userRedemptionCount: number }
 */
function evaluatePromotion(promotion, ctx) {
  const { cartItems, now, userRedemptionCount = 0 } = ctx;

  if (!cartItems || cartItems.length === 0) {
    return fail(CODES.EMPTY_CART, "Your cart is empty.");
  }
  if (!promotion) {
    return fail(CODES.NOT_FOUND, "This coupon code does not exist.");
  }
  if (promotion.status !== "ACTIVE") {
    return fail(CODES.INACTIVE, "This coupon is not currently active.");
  }
  if (now < promotion.startAt) {
    return fail(CODES.NOT_STARTED, "This coupon is not active yet.");
  }
  if (now > promotion.endAt) {
    return fail(CODES.EXPIRED, "This coupon has expired.");
  }

  const eligibleItems = cartItems.filter((item) => isCategoryEligible(promotion, item.categoryId));
  const eligibleSubtotal = sumLineTotals(eligibleItems);

  if (eligibleItems.length === 0) {
    return fail(CODES.NO_ELIGIBLE_ITEMS, "This coupon does not apply to any products in your cart.");
  }

  const minimumOrderValue = new Decimal(promotion.minimumOrderValue);
  if (eligibleSubtotal.lt(minimumOrderValue)) {
    const shortfall = minimumOrderValue.minus(eligibleSubtotal);
    return fail(CODES.MIN_ORDER, `Add AED ${shortfall.toFixed(2)} more to use this coupon.`, {
      minimumOrderValue: minimumOrderValue.toFixed(2),
      currentSubtotal: eligibleSubtotal.toFixed(2),
      shortfall: shortfall.toFixed(2),
    });
  }

  if (promotion.perUserUsageLimit != null && userRedemptionCount >= promotion.perUserUsageLimit) {
    return fail(CODES.CUSTOMER_LIMIT, "You have already used this coupon the maximum number of times.");
  }

  if (promotion.totalUsageLimit != null && promotion.currentUsage >= promotion.totalUsageLimit) {
    return fail(CODES.TOTAL_LIMIT, "This coupon has reached its total usage limit.");
  }

  return {
    ok: true,
    promotion,
    eligibleItems,
    eligibleSubtotal,
    cartSubtotal: sumLineTotals(cartItems),
  };
}

module.exports = { evaluatePromotion, isCategoryEligible, CODES };
