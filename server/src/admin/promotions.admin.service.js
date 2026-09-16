const prisma = require("../database/prisma");
const AppError = require("../utils/AppError");
const { log } = require("../utils/logger");
const { Decimal } = require("../utils/money");
const { serializePromotionAdmin } = require("../promotions/promotions.mapper");
const { toMoneyString } = require("../utils/money");

const PROMOTION_INCLUDE = { categories: { include: { category: true } } };

function validatePromotionInput(input, { isCreate }) {
  const errors = [];

  if (isCreate && (!input.code || !input.code.trim())) {
    errors.push("Coupon code cannot be empty.");
  }
  if (!input.name || !input.name.trim()) {
    errors.push("Promotion name is required.");
  }
  if (!["PERCENTAGE", "FLAT"].includes(input.discountType)) {
    errors.push("Discount type must be PERCENTAGE or FLAT.");
  }

  const discountValue = new Decimal(input.discountValue ?? NaN);
  if (discountValue.isNaN() || discountValue.lte(0)) {
    errors.push("Discount value must be positive.");
  } else if (input.discountType === "PERCENTAGE" && (discountValue.lt(0) || discountValue.gt(100))) {
    errors.push("Percentage must be between 0 and 100.");
  }

  if (input.maximumDiscount !== null && input.maximumDiscount !== undefined && input.maximumDiscount !== "") {
    const maxDiscount = new Decimal(input.maximumDiscount);
    if (maxDiscount.isNaN() || maxDiscount.lte(0)) {
      errors.push("Maximum discount must be positive.");
    }
  }

  const minOrder = new Decimal(input.minimumOrderValue ?? 0);
  if (minOrder.isNaN() || minOrder.lt(0)) {
    errors.push("Minimum order value cannot be negative.");
  }

  const appliesToAll = Boolean(input.appliesToAllCategories);
  if (!appliesToAll && (!Array.isArray(input.categoryIds) || input.categoryIds.length === 0)) {
    errors.push("At least one category must be selected when using selected-category mode.");
  }

  if (!input.startAt || !input.endAt || isNaN(Date.parse(input.startAt)) || isNaN(Date.parse(input.endAt))) {
    errors.push("Valid start and end dates are required.");
  } else if (new Date(input.endAt) <= new Date(input.startAt)) {
    errors.push("End date must be after start date.");
  }

  if (input.totalUsageLimit !== null && input.totalUsageLimit !== undefined && input.totalUsageLimit !== "") {
    if (!Number.isInteger(Number(input.totalUsageLimit)) || Number(input.totalUsageLimit) < 0) {
      errors.push("Total usage limit cannot be negative.");
    }
  }
  if (input.perUserUsageLimit !== null && input.perUserUsageLimit !== undefined && input.perUserUsageLimit !== "") {
    if (!Number.isInteger(Number(input.perUserUsageLimit)) || Number(input.perUserUsageLimit) < 0) {
      errors.push("Per user usage limit cannot be negative.");
    }
  }

  if (input.status && !["ACTIVE", "PAUSED"].includes(input.status)) {
    errors.push("Status must be ACTIVE or PAUSED.");
  }

  if (errors.length > 0) {
    throw new AppError(422, "VALIDATION_ERROR", errors[0], { errors });
  }
}

function toNullableInt(value) {
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function toNullableDecimalString(value) {
  return value === null || value === undefined || value === "" ? null : new Decimal(value).toFixed(2);
}

async function createPromotion(input) {
  validatePromotionInput(input, { isCreate: true });

  const code = input.code.trim().toUpperCase();
  const existing = await prisma.promotion.findUnique({ where: { code } });
  if (existing) {
    throw new AppError(409, "DUPLICATE_ENTRY", "A promotion with this coupon code already exists.");
  }

  const appliesToAllCategories = Boolean(input.appliesToAllCategories);

  const promotion = await prisma.promotion.create({
    data: {
      code,
      name: input.name.trim(),
      discountType: input.discountType,
      discountValue: new Decimal(input.discountValue).toFixed(2),
      maximumDiscount: toNullableDecimalString(input.maximumDiscount),
      minimumOrderValue: new Decimal(input.minimumOrderValue ?? 0).toFixed(2),
      appliesToAllCategories,
      status: input.status || "ACTIVE",
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      totalUsageLimit: toNullableInt(input.totalUsageLimit),
      perUserUsageLimit: toNullableInt(input.perUserUsageLimit),
      categories: appliesToAllCategories
        ? undefined
        : { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
    },
    include: PROMOTION_INCLUDE,
  });

  log("promotion.created", { promotionId: promotion.id, code: promotion.code });
  return serializePromotionAdmin(promotion);
}

async function updatePromotion(id, input) {
  const existing = await prisma.promotion.findUnique({ where: { id }, include: PROMOTION_INCLUDE });
  if (!existing) throw new AppError(404, "PROMOTION_NOT_FOUND", "Promotion not found.");

  const merged = {
    code: existing.code,
    name: input.name ?? existing.name,
    discountType: input.discountType ?? existing.discountType,
    discountValue: input.discountValue ?? existing.discountValue,
    maximumDiscount: input.maximumDiscount !== undefined ? input.maximumDiscount : existing.maximumDiscount,
    minimumOrderValue: input.minimumOrderValue ?? existing.minimumOrderValue,
    appliesToAllCategories:
      input.appliesToAllCategories !== undefined ? input.appliesToAllCategories : existing.appliesToAllCategories,
    categoryIds: input.categoryIds ?? existing.categories.map((c) => c.categoryId),
    startAt: input.startAt ?? existing.startAt,
    endAt: input.endAt ?? existing.endAt,
    totalUsageLimit: input.totalUsageLimit !== undefined ? input.totalUsageLimit : existing.totalUsageLimit,
    perUserUsageLimit: input.perUserUsageLimit !== undefined ? input.perUserUsageLimit : existing.perUserUsageLimit,
    status: input.status ?? existing.status,
  };
  validatePromotionInput(merged, { isCreate: false });

  const appliesToAllCategories = Boolean(merged.appliesToAllCategories);

  const promotion = await prisma.$transaction(async (tx) => {
    await tx.promotionCategory.deleteMany({ where: { promotionId: id } });
    return tx.promotion.update({
      where: { id },
      data: {
        name: merged.name.trim(),
        discountType: merged.discountType,
        discountValue: new Decimal(merged.discountValue).toFixed(2),
        maximumDiscount: toNullableDecimalString(merged.maximumDiscount),
        minimumOrderValue: new Decimal(merged.minimumOrderValue).toFixed(2),
        appliesToAllCategories,
        status: merged.status,
        startAt: new Date(merged.startAt),
        endAt: new Date(merged.endAt),
        totalUsageLimit: toNullableInt(merged.totalUsageLimit),
        perUserUsageLimit: toNullableInt(merged.perUserUsageLimit),
        categories: appliesToAllCategories
          ? undefined
          : { create: merged.categoryIds.map((categoryId) => ({ categoryId })) },
      },
      include: PROMOTION_INCLUDE,
    });
  });

  log("promotion.updated", { promotionId: promotion.id });
  return serializePromotionAdmin(promotion);
}

async function setStatus(id, status) {
  if (!["ACTIVE", "PAUSED"].includes(status)) {
    throw new AppError(422, "VALIDATION_ERROR", "Status must be ACTIVE or PAUSED.");
  }
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "PROMOTION_NOT_FOUND", "Promotion not found.");

  const promotion = await prisma.promotion.update({
    where: { id },
    data: { status },
    include: PROMOTION_INCLUDE,
  });

  log(status === "ACTIVE" ? "promotion.activated" : "promotion.paused", { promotionId: id });
  return serializePromotionAdmin(promotion);
}

async function listPromotions() {
  const promotions = await prisma.promotion.findMany({
    include: PROMOTION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return promotions.map(serializePromotionAdmin);
}

async function getPromotionDetail(id) {
  const promotion = await prisma.promotion.findUnique({
    where: { id },
    include: {
      ...PROMOTION_INCLUDE,
      redemptions: { orderBy: { createdAt: "desc" }, take: 20, include: { user: true } },
    },
  });
  if (!promotion) throw new AppError(404, "PROMOTION_NOT_FOUND", "Promotion not found.");

  return {
    ...serializePromotionAdmin(promotion),
    recentRedemptions: promotion.redemptions.map((r) => ({
      id: r.id,
      userName: r.user.name,
      userEmail: r.user.email,
      discountAmount: toMoneyString(r.discountAmount),
      createdAt: r.createdAt,
      orderId: r.orderId,
    })),
  };
}

module.exports = { createPromotion, updatePromotion, setStatus, listPromotions, getPromotionDetail };
