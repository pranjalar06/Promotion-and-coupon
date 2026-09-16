const { Decimal } = require("../src/utils/money");
const { evaluatePromotion, CODES } = require("../src/promotions/promotionEngine");

function line(productId, categoryId, lineTotal) {
  return { productId, categoryId, lineTotal: new Decimal(lineTotal) };
}

function basePromotion(overrides = {}) {
  return {
    code: "TEST",
    status: "ACTIVE",
    startAt: new Date("2020-01-01"),
    endAt: new Date("2030-01-01"),
    appliesToAllCategories: true,
    categoryIds: [],
    minimumOrderValue: 0,
    discountType: "PERCENTAGE",
    discountValue: 10,
    maximumDiscount: null,
    totalUsageLimit: null,
    perUserUsageLimit: null,
    currentUsage: 0,
    ...overrides,
  };
}

const NOW = new Date("2025-06-01");

describe("promotionEngine.evaluatePromotion", () => {
  test("fails with PROMOTION_NOT_FOUND when promotion is null", () => {
    const result = evaluatePromotion(null, { cartItems: [line("p1", "c1", 100)], now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.NOT_FOUND);
  });

  test("fails with CART_EMPTY when cart has no items", () => {
    const result = evaluatePromotion(basePromotion(), { cartItems: [], now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.EMPTY_CART);
  });

  test("fails when promotion is PAUSED", () => {
    const promo = basePromotion({ status: "PAUSED" });
    const result = evaluatePromotion(promo, { cartItems: [line("p1", "c1", 100)], now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.INACTIVE);
  });

  test("fails when promotion has not started", () => {
    const promo = basePromotion({ startAt: new Date("2030-01-01") });
    const result = evaluatePromotion(promo, { cartItems: [line("p1", "c1", 100)], now: NOW });
    expect(result.code).toBe(CODES.NOT_STARTED);
  });

  test("fails when promotion has expired", () => {
    const promo = basePromotion({ endAt: new Date("2020-01-01") });
    const result = evaluatePromotion(promo, { cartItems: [line("p1", "c1", 100)], now: NOW });
    expect(result.code).toBe(CODES.EXPIRED);
  });

  test("all-category promotion is eligible for every cart item", () => {
    const promo = basePromotion();
    const cartItems = [line("p1", "electronics", 3000), line("p2", "fashion", 800)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW });
    expect(result.ok).toBe(true);
    expect(result.eligibleSubtotal.toFixed(2)).toBe("3800.00");
  });

  test("category-restricted promotion only counts matching items and excludes the rest", () => {
    const promo = basePromotion({ appliesToAllCategories: false, categoryIds: ["electronics"], minimumOrderValue: 1000 });
    const cartItems = [line("p1", "electronics", 3000), line("p2", "fashion", 800), line("p3", "beauty", 500)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW });
    expect(result.ok).toBe(true);
    expect(result.eligibleItems).toHaveLength(1);
    expect(result.eligibleSubtotal.toFixed(2)).toBe("3000.00");
    expect(result.cartSubtotal.toFixed(2)).toBe("4300.00");
  });

  test("fails with NO_ELIGIBLE_ITEMS when no cart items match restricted categories", () => {
    const promo = basePromotion({ appliesToAllCategories: false, categoryIds: ["electronics"] });
    const cartItems = [line("p1", "fashion", 800), line("p2", "beauty", 500)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.NO_ELIGIBLE_ITEMS);
  });

  test("fails with MIN_ORDER_VALUE_NOT_MET and reports shortfall", () => {
    const promo = basePromotion({ minimumOrderValue: 1000 });
    const cartItems = [line("p1", "electronics", 750)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.MIN_ORDER);
    expect(result.data.shortfall).toBe("250.00");
  });

  test("minimum order is evaluated against the eligible (category-restricted) subtotal", () => {
    const promo = basePromotion({
      appliesToAllCategories: false,
      categoryIds: ["electronics"],
      minimumOrderValue: 2000,
    });
    // Cart subtotal is well above minimum, but eligible (electronics) subtotal is not.
    const cartItems = [line("p1", "electronics", 1000), line("p2", "fashion", 5000)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.MIN_ORDER);
  });

  test("fails with CUSTOMER_LIMIT_REACHED when per-user limit already consumed", () => {
    const promo = basePromotion({ perUserUsageLimit: 1 });
    const cartItems = [line("p1", "electronics", 1000)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW, userRedemptionCount: 1 });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.CUSTOMER_LIMIT);
  });

  test("fails with TOTAL_USAGE_LIMIT_REACHED when currentUsage meets the limit", () => {
    const promo = basePromotion({ totalUsageLimit: 5, currentUsage: 5 });
    const cartItems = [line("p1", "electronics", 1000)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CODES.TOTAL_LIMIT);
  });

  test("succeeds when under total and per-user usage limits", () => {
    const promo = basePromotion({ totalUsageLimit: 5, currentUsage: 4, perUserUsageLimit: 2 });
    const cartItems = [line("p1", "electronics", 1000)];
    const result = evaluatePromotion(promo, { cartItems, now: NOW, userRedemptionCount: 1 });
    expect(result.ok).toBe(true);
  });
});
