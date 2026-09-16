const { toDecimal, toMoneyString } = require("../utils/money");

// Builds the normalized line-item shape the pricing/promotion engines operate on
// from a Prisma cart loaded with `items.product.category`.
function buildLineItems(cart) {
  return cart.items.map((item) => {
    const unitPrice = toDecimal(item.product.price);
    return {
      cartItemId: item.id,
      productId: item.productId,
      categoryId: item.product.categoryId,
      categoryName: item.product.category.name,
      productName: item.product.name,
      sku: item.product.sku,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice.times(item.quantity),
    };
  });
}

function serializeLineItem(lineItem) {
  return {
    cartItemId: lineItem.cartItemId,
    productId: lineItem.productId,
    productName: lineItem.productName,
    sku: lineItem.sku,
    category: lineItem.categoryName,
    quantity: lineItem.quantity,
    unitPrice: toMoneyString(lineItem.unitPrice),
    lineTotal: toMoneyString(lineItem.lineTotal),
    discount: toMoneyString(lineItem.discount || 0),
    finalPrice: toMoneyString(lineItem.finalPrice || lineItem.lineTotal),
  };
}

function serializePricing(pricing, appliedCoupon) {
  return {
    items: pricing.lineAllocations.map(serializeLineItem),
    subtotal: toMoneyString(pricing.subtotal),
    eligibleSubtotal: toMoneyString(pricing.eligibleSubtotal),
    discount: toMoneyString(pricing.discount),
    total: toMoneyString(pricing.total),
    coupon: appliedCoupon || null,
  };
}

module.exports = { buildLineItems, serializeLineItem, serializePricing };
