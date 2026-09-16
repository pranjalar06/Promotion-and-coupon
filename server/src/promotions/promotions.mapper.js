const { toMoneyString } = require("../utils/money");

// Normalizes a Prisma Promotion (with `categories` relation loaded) into the
// plain shape the promotion/pricing engines operate on.
function normalizePromotion(promotion) {
  return {
    id: promotion.id,
    code: promotion.code,
    name: promotion.name,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    maximumDiscount: promotion.maximumDiscount,
    minimumOrderValue: promotion.minimumOrderValue,
    appliesToAllCategories: promotion.appliesToAllCategories,
    categoryIds: (promotion.categories || []).map((pc) => pc.categoryId),
    status: promotion.status,
    startAt: promotion.startAt,
    endAt: promotion.endAt,
    totalUsageLimit: promotion.totalUsageLimit,
    perUserUsageLimit: promotion.perUserUsageLimit,
    currentUsage: promotion.currentUsage,
  };
}

function serializePromotionSummary(promotion) {
  return {
    code: promotion.code,
    name: promotion.name,
    type: promotion.discountType,
    value:
      promotion.discountType === "PERCENTAGE"
        ? Number(promotion.discountValue)
        : toMoneyString(promotion.discountValue),
  };
}

function serializePromotionAdmin(promotion) {
  return {
    id: promotion.id,
    code: promotion.code,
    name: promotion.name,
    discountType: promotion.discountType,
    discountValue: toMoneyString(promotion.discountValue),
    maximumDiscount: promotion.maximumDiscount !== null ? toMoneyString(promotion.maximumDiscount) : null,
    minimumOrderValue: toMoneyString(promotion.minimumOrderValue),
    appliesToAllCategories: promotion.appliesToAllCategories,
    categories: (promotion.categories || []).map((pc) => ({
      id: pc.category.id,
      name: pc.category.name,
      slug: pc.category.slug,
    })),
    status: promotion.status,
    startAt: promotion.startAt,
    endAt: promotion.endAt,
    totalUsageLimit: promotion.totalUsageLimit,
    perUserUsageLimit: promotion.perUserUsageLimit,
    currentUsage: promotion.currentUsage,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  };
}

module.exports = { normalizePromotion, serializePromotionSummary, serializePromotionAdmin };
