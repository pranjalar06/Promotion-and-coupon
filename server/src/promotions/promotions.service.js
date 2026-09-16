const prisma = require("../database/prisma");
const promotionEngine = require("./promotionEngine");
const { normalizePromotion } = require("./promotions.mapper");

async function findPromotionByCode(code) {
  if (!code) return null;
  return prisma.promotion.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { categories: true },
  });
}

/**
 * Evaluates whether a coupon code applies to the given cart line items for a user.
 * Read-only: does NOT mutate usage counters or create redemptions.
 * @returns {{ result: object, promotionRecord: object|null }}
 */
async function evaluateCoupon({ code, lineItems, userId, now = new Date() }) {
  const promotionRecord = await findPromotionByCode(code);

  let userRedemptionCount = 0;
  if (promotionRecord) {
    userRedemptionCount = await prisma.redemption.count({
      where: { promotionId: promotionRecord.id, userId },
    });
  }

  const normalized = promotionRecord ? normalizePromotion(promotionRecord) : null;
  const result = promotionEngine.evaluatePromotion(normalized, {
    cartItems: lineItems,
    now,
    userRedemptionCount,
  });

  return { result, promotionRecord };
}

module.exports = { findPromotionByCode, evaluateCoupon };
