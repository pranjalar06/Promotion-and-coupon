const { toMoneyString } = require("../utils/money");

function serializeOrderItem(item) {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    category: item.categoryName,
    quantity: item.quantity,
    unitPrice: toMoneyString(item.unitPrice),
    discount: toMoneyString(item.discount),
    finalPrice: toMoneyString(item.finalPrice),
  };
}

function serializeOrder(order) {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: toMoneyString(order.subtotal),
    discount: toMoneyString(order.discount),
    total: toMoneyString(order.total),
    couponCode: order.couponCode,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      address: order.customerAddress,
    },
    items: (order.items || []).map(serializeOrderItem),
    itemCount: (order.items || []).reduce((sum, i) => sum + i.quantity, 0),
    createdAt: order.createdAt,
  };
}

module.exports = { serializeOrder, serializeOrderItem };
