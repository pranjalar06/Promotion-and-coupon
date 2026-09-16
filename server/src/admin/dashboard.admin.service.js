const prisma = require("../database/prisma");
const { Decimal, toMoneyString } = require("../utils/money");

async function getDashboard() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalPromotions, activePromotions, totalRedemptions, redemptionsToday, allRedemptions, recentRedemptions] =
    await Promise.all([
      prisma.promotion.count(),
      prisma.promotion.count({ where: { status: "ACTIVE" } }),
      prisma.redemption.count(),
      prisma.redemption.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.redemption.findMany({ select: { discountAmount: true, couponCode: true } }),
      prisma.redemption.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: true, promotion: true },
      }),
    ]);

  const totalDiscountGiven = allRedemptions.reduce((sum, r) => sum.plus(r.discountAmount), new Decimal(0));

  const usageByCoupon = new Map();
  allRedemptions.forEach((r) => {
    usageByCoupon.set(r.couponCode, (usageByCoupon.get(r.couponCode) || 0) + 1);
  });
  const topCoupons = [...usageByCoupon.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, redemptions: count }));

  return {
    activePromotions,
    totalPromotions,
    totalRedemptions,
    redemptionsToday,
    totalDiscountGiven: toMoneyString(totalDiscountGiven),
    topCoupons,
    recentRedemptions: recentRedemptions.map((r) => ({
      id: r.id,
      couponCode: r.couponCode,
      userName: r.user.name,
      discountAmount: toMoneyString(r.discountAmount),
      createdAt: r.createdAt,
    })),
  };
}

module.exports = { getDashboard };
