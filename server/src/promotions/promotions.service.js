const prisma = require("../database/prisma");
const promotionEngine = require("./promotionEngine");
const { normalizePromotion } = require("./promotions.mapper");
const { toMoneyString } = require("../utils/money");

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

// Public-facing list of coupons a shopper could currently use: active, within
// their validity window, and not yet exhausted. Deliberately excludes internal
// fields like currentUsage/perUserUsageLimit — those are enforced at apply time,
// not advertised here.
async function listAvailablePromotions() {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: { status: "ACTIVE", startAt: { lte: now }, endAt: { gte: now } },
    include: { categories: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });

  return promotions
    .filter((promo) => promo.totalUsageLimit == null || promo.currentUsage < promo.totalUsageLimit)
    .map((promo) => ({
      code: promo.code,
      name: promo.name,
      discountType: promo.discountType,
      discountValue:
        promo.discountType === "PERCENTAGE" ? Number(promo.discountValue) : toMoneyString(promo.discountValue),
      maximumDiscount: promo.maximumDiscount !== null ? toMoneyString(promo.maximumDiscount) : null,
      minimumOrderValue: toMoneyString(promo.minimumOrderValue),
      appliesToAllCategories: promo.appliesToAllCategories,
      categories: promo.categories.map((pc) => pc.category.name),
      endAt: promo.endAt,
    }));
}

// Same "currently usable" filter as listAvailablePromotions, but additionally
// evaluates each promotion against a specific cart (via the same promotion
// engine used by apply/checkout) so callers can show which coupons the
// customer can actually use right now versus which are just visible.
async function listAvailablePromotionsWithEligibility({ lineItems, userId, now = new Date() }) {
  const promotions = await prisma.promotion.findMany({
    where: { status: "ACTIVE", startAt: { lte: now }, endAt: { gte: now } },
    include: { categories: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });

  const withCapacity = promotions.filter(
    (promo) => promo.totalUsageLimit == null || promo.currentUsage < promo.totalUsageLimit
  );

  const results = [];
  for (const promo of withCapacity) {
    const userRedemptionCount = await prisma.redemption.count({
      where: { promotionId: promo.id, userId },
    });
    const evalResult = promotionEngine.evaluatePromotion(normalizePromotion(promo), {
      cartItems: lineItems,
      now,
      userRedemptionCount,
    });

    results.push({
      code: promo.code,
      name: promo.name,
      discountType: promo.discountType,
      discountValue:
        promo.discountType === "PERCENTAGE" ? Number(promo.discountValue) : toMoneyString(promo.discountValue),
      maximumDiscount: promo.maximumDiscount !== null ? toMoneyString(promo.maximumDiscount) : null,
      minimumOrderValue: toMoneyString(promo.minimumOrderValue),
      appliesToAllCategories: promo.appliesToAllCategories,
      categories: promo.categories.map((pc) => pc.category.name),
      endAt: promo.endAt,
      eligible: evalResult.ok,
      reasonCode: evalResult.ok ? null : evalResult.code,
      reasonMessage: evalResult.ok ? null : evalResult.message,
    });
  }

  return results;
}

module.exports = {
  findPromotionByCode,
  evaluateCoupon,
  listAvailablePromotions,
  listAvailablePromotionsWithEligibility,
};
