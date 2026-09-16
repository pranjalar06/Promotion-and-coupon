const { Decimal } = require("../src/utils/money");
const { calculatePricing, calculateDiscountAmount } = require("../src/pricing/pricingEngine");
const { evaluatePromotion } = require("../src/promotions/promotionEngine");

function line(productId, categoryId, unitPrice, quantity) {
  const price = new Decimal(unitPrice);
  return { productId, categoryId, unitPrice: price, quantity, lineTotal: price.times(quantity) };
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

function evaluate(promotion, cartItems) {
  return evaluatePromotion(promotion, { cartItems, now: NOW });
}

describe("pricingEngine.calculatePricing", () => {
  test("no coupon: total equals subtotal, discount is zero", () => {
    const cartItems = [line("p1", "electronics", "2000.00", 1)];
    const pricing = calculatePricing(cartItems, null);
    expect(pricing.subtotal.toFixed(2)).toBe("2000.00");
    expect(pricing.discount.toFixed(2)).toBe("0.00");
    expect(pricing.total.toFixed(2)).toBe("2000.00");
  });

  test("percentage discount applies only to eligible category and allocates correctly", () => {
    const promo = basePromotion({ appliesToAllCategories: false, categoryIds: ["electronics"], discountValue: 20 });
    const cartItems = [line("laptop", "electronics", "3000.00", 1), line("tshirt", "fashion", "800.00", 1)];
    const evalResult = evaluate(promo, cartItems);
    const pricing = calculatePricing(cartItems, evalResult);

    expect(pricing.subtotal.toFixed(2)).toBe("3800.00");
    expect(pricing.eligibleSubtotal.toFixed(2)).toBe("3000.00");
    expect(pricing.discount.toFixed(2)).toBe("600.00");
    expect(pricing.total.toFixed(2)).toBe("3200.00");

    const fashionLine = pricing.lineAllocations.find((l) => l.productId === "tshirt");
    expect(fashionLine.discount.toFixed(2)).toBe("0.00");
    const electronicsLine = pricing.lineAllocations.find((l) => l.productId === "laptop");
    expect(electronicsLine.discount.toFixed(2)).toBe("600.00");
  });

  test("maximum discount cap is enforced", () => {
    const promo = basePromotion({ discountValue: 20, maximumDiscount: "500.00" });
    const cartItems = [line("p1", "electronics", "5000.00", 1)];
    const evalResult = evaluate(promo, cartItems);
    const pricing = calculatePricing(cartItems, evalResult);
    // raw 20% of 5000 = 1000, capped at 500
    expect(pricing.discount.toFixed(2)).toBe("500.00");
    expect(pricing.total.toFixed(2)).toBe("4500.00");
  });

  test("flat discount never exceeds eligible subtotal", () => {
    const promo = basePromotion({ discountType: "FLAT", discountValue: "100.00" });
    const cartItems = [line("p1", "grocery", "50.00", 1)];
    const evalResult = evaluate(promo, cartItems);
    const pricing = calculatePricing(cartItems, evalResult);
    expect(pricing.discount.toFixed(2)).toBe("50.00");
    expect(pricing.total.toFixed(2)).toBe("0.00");
  });

  test("discount allocation across multiple eligible lines sums exactly to total discount", () => {
    const promo = basePromotion({ discountType: "FLAT", discountValue: "500.00" });
    const cartItems = [
      line("a", "electronics", "333.33", 1),
      line("b", "electronics", "333.33", 1),
      line("c", "electronics", "333.34", 1),
    ];
    const evalResult = evaluate(promo, cartItems);
    const pricing = calculatePricing(cartItems, evalResult);
    const sumAllocated = pricing.lineAllocations.reduce((s, l) => s.plus(l.discount), new Decimal(0));
    expect(sumAllocated.toFixed(2)).toBe(pricing.discount.toFixed(2));
  });

  test("invariants: discount >= 0, discount <= eligibleSubtotal, total >= 0", () => {
    const promo = basePromotion({ discountType: "PERCENTAGE", discountValue: 100 });
    const cartItems = [line("p1", "electronics", "999.99", 3)];
    const evalResult = evaluate(promo, cartItems);
    const pricing = calculatePricing(cartItems, evalResult);
    expect(pricing.discount.gte(0)).toBe(true);
    expect(pricing.discount.lte(pricing.eligibleSubtotal)).toBe(true);
    expect(pricing.total.gte(0)).toBe(true);
  });

  test("calculateDiscountAmount clamps percentage discount at 100% of eligible subtotal", () => {
    const promo = basePromotion({ discountType: "PERCENTAGE", discountValue: 100 });
    const discount = calculateDiscountAmount(promo, new Decimal("250.00"));
    expect(discount.toFixed(2)).toBe("250.00");
  });
});
