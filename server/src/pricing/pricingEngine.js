const { Decimal } = require("../utils/money");

// Pure, DB-independent pricing logic. Given cart line items and an optional
// successful promotion evaluation, computes subtotal/eligibleSubtotal/discount/total
// and allocates the discount deterministically across eligible line items.
//
// Invariants enforced here:
//   discount >= 0
//   discount <= eligibleSubtotal
//   total >= 0
//   sum(lineAllocations.discount) === discount

function calculateDiscountAmount(promotion, eligibleSubtotal) {
  let raw;
  if (promotion.discountType === "PERCENTAGE") {
    raw = eligibleSubtotal.times(promotion.discountValue).dividedBy(100);
  } else {
    raw = new Decimal(promotion.discountValue);
  }

  let discount = Decimal.min(raw, eligibleSubtotal);
  if (promotion.maximumDiscount !== null && promotion.maximumDiscount !== undefined) {
    discount = Decimal.min(discount, new Decimal(promotion.maximumDiscount));
  }
  if (discount.lt(0)) discount = new Decimal(0);
  return discount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// Proportional allocation by line share of the eligible subtotal, with the final
// eligible line absorbing the rounding remainder so allocations always sum exactly.
function allocateDiscount(eligibleItems, totalDiscount, eligibleSubtotal) {
  if (eligibleItems.length === 0 || totalDiscount.eq(0)) {
    const map = new Map();
    eligibleItems.forEach((item) => map.set(item.productId, new Decimal(0)));
    return map;
  }

  const map = new Map();
  let allocated = new Decimal(0);
  eligibleItems.forEach((item, idx) => {
    if (idx === eligibleItems.length - 1) {
      map.set(item.productId, totalDiscount.minus(allocated));
      return;
    }
    const share = eligibleSubtotal.eq(0)
      ? new Decimal(0)
      : item.lineTotal.times(totalDiscount).dividedBy(eligibleSubtotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    allocated = allocated.plus(share);
    map.set(item.productId, share);
  });
  return map;
}

/**
 * @param {Array} cartItems - [{ productId, categoryId, categoryName, productName, sku, unitPrice: Decimal, quantity, lineTotal: Decimal }]
 * @param {object|null} promotionEvaluation - result of promotionEngine.evaluatePromotion when ok === true, or null/undefined for no coupon
 */
function calculatePricing(cartItems, promotionEvaluation) {
  const subtotal = cartItems.reduce((sum, item) => sum.plus(item.lineTotal), new Decimal(0));

  if (!promotionEvaluation || !promotionEvaluation.ok) {
    return {
      subtotal,
      eligibleSubtotal: new Decimal(0),
      discount: new Decimal(0),
      total: subtotal,
      lineAllocations: cartItems.map((item) => ({
        ...item,
        discount: new Decimal(0),
        finalPrice: item.lineTotal,
      })),
      promotion: null,
    };
  }

  const { eligibleItems, eligibleSubtotal, promotion } = promotionEvaluation;
  const discount = calculateDiscountAmount(promotion, eligibleSubtotal);
  const allocationMap = allocateDiscount(eligibleItems, discount, eligibleSubtotal);

  const lineAllocations = cartItems.map((item) => {
    const itemDiscount = allocationMap.get(item.productId) || new Decimal(0);
    return { ...item, discount: itemDiscount, finalPrice: item.lineTotal.minus(itemDiscount) };
  });

  let total = subtotal.minus(discount);
  if (total.lt(0)) total = new Decimal(0);

  return { subtotal, eligibleSubtotal, discount, total, lineAllocations, promotion };
}

module.exports = { calculatePricing, calculateDiscountAmount, allocateDiscount };
