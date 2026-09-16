const {
  request,
  app,
  prisma,
  resetDb,
  signup,
  createCategory,
  createProduct,
  createPromotion,
  getMyCartId,
  addToCart,
} = require("./helpers");

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

function checkoutBody(overrides = {}) {
  return {
    customerName: "Test Customer",
    customerEmail: "customer@test.com",
    customerAddress: "42 Market Street",
    paymentOutcome: "SUCCESS",
    idempotencyKey: `key-${Date.now()}-${Math.random()}`,
    ...overrides,
  };
}

describe("Checkout and transactional redemption", () => {
  test("payment failure leaves cart, order, and usage untouched", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "500.00" });
    const promo = await createPromotion({ code: "FAILFLOW10" });
    const { token, user } = await signup();
    const cartId = await addToCart(token, product.id, 2);
    await request(app).post(`/api/v1/carts/${cartId}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });

    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send(checkoutBody({ paymentOutcome: "FAILED" }));

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("FAILED");
    expect(res.body.order).toBeNull();

    const orders = await prisma.order.count({ where: { userId: user.id } });
    expect(orders).toBe(0);
    const redemptions = await prisma.redemption.count({ where: { promotionId: promo.id } });
    expect(redemptions).toBe(0);
    const refreshedPromo = await prisma.promotion.findUnique({ where: { id: promo.id } });
    expect(refreshedPromo.currentUsage).toBe(0);

    const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } });
    expect(cart.items).toHaveLength(1);
    expect(cart.couponCode).toBe(promo.code);
  });

  test("successful payment creates order, redeems coupon, decrements stock, and clears cart", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "1000.00", stock: 10 });
    const promo = await createPromotion({ code: "SUCCESS10X", discountType: "FLAT", discountValue: "100.00", minimumOrderValue: "500.00", perUserUsageLimit: 1, totalUsageLimit: 10 });
    const { token, user } = await signup();
    const cartId = await addToCart(token, product.id, 2);
    await request(app).post(`/api/v1/carts/${cartId}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });

    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send(checkoutBody());

    expect(res.status).toBe(201);
    expect(res.body.paymentStatus).toBe("SUCCESS");
    expect(res.body.order.subtotal).toBe("2000.00");
    expect(res.body.order.discount).toBe("100.00");
    expect(res.body.order.total).toBe("1900.00");

    const refreshedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(refreshedProduct.stock).toBe(8);

    const refreshedPromo = await prisma.promotion.findUnique({ where: { id: promo.id } });
    expect(refreshedPromo.currentUsage).toBe(1);

    const redemption = await prisma.redemption.findFirst({ where: { promotionId: promo.id, userId: user.id } });
    expect(redemption).toBeTruthy();
    expect(redemption.discountAmount.toFixed(2)).toBe("100.00");

    const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } });
    expect(cart.items).toHaveLength(0);
    expect(cart.couponCode).toBeNull();
  });

  test("re-applying a per-user-limit-1 coupon after it has already been redeemed is rejected", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "1000.00", stock: 10 });
    const promo = await createPromotion({ code: "ONEUSE", perUserUsageLimit: 1 });
    const { token } = await signup();

    const cartId1 = await addToCart(token, product.id, 1);
    await request(app).post(`/api/v1/carts/${cartId1}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });
    const first = await request(app).post("/api/v1/orders/checkout").set("Authorization", `Bearer ${token}`).send(checkoutBody());
    expect(first.status).toBe(201);

    // Same user, same (now-cleared and reused) cart — applying the same coupon again
    // must be blocked at apply-time since their per-user redemption limit is already spent.
    const cartId2 = await addToCart(token, product.id, 1);
    const secondApply = await request(app)
      .post(`/api/v1/carts/${cartId2}/coupons`)
      .set("Authorization", `Bearer ${token}`)
      .send({ code: promo.code });
    expect(secondApply.status).toBe(422);
    expect(secondApply.body.error.code).toBe("CUSTOMER_LIMIT_REACHED");

    // Since the coupon was never attached to the cart, checkout still succeeds — just with no discount.
    const second = await request(app).post("/api/v1/orders/checkout").set("Authorization", `Bearer ${token}`).send(checkoutBody());
    expect(second.status).toBe(201);
    expect(second.body.order.discount).toBe("0.00");
  });

  test("duplicate checkout submissions with the same idempotency key create only one order", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "1000.00", stock: 50 });
    const { token, user } = await signup();
    const cartId = await addToCart(token, product.id, 1);
    const body = checkoutBody({ idempotencyKey: "same-key-double-click" });

    const [res1, res2] = await Promise.all([
      request(app).post("/api/v1/orders/checkout").set("Authorization", `Bearer ${token}`).send(body),
      request(app).post("/api/v1/orders/checkout").set("Authorization", `Bearer ${token}`).send(body),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One request creates the order; the other is rejected as a duplicate-in-flight,
    // or (rarely, if it lands after commit) receives the cached success response.
    expect([201, 409]).toContain(statuses[0]);
    expect([201, 409]).toContain(statuses[1]);

    const orderCount = await prisma.order.count({ where: { userId: user.id } });
    expect(orderCount).toBe(1);
  });

  test("concurrent checkouts by different users against a coupon with 1 remaining use: exactly one succeeds", async () => {
    const category = await createCategory();
    const productA = await createProduct(category.id, { price: "1000.00", stock: 50 });
    const productB = await createProduct(category.id, { price: "1000.00", stock: 50 });
    const promo = await createPromotion({ code: "LASTUSE", totalUsageLimit: 1, minimumOrderValue: "0.00" });

    const userA = await signup({ email: "concurrent-a@test.com" });
    const userB = await signup({ email: "concurrent-b@test.com" });

    const cartA = await addToCart(userA.token, productA.id, 1);
    const cartB = await addToCart(userB.token, productB.id, 1);
    await request(app).post(`/api/v1/carts/${cartA}/coupons`).set("Authorization", `Bearer ${userA.token}`).send({ code: promo.code });
    await request(app).post(`/api/v1/carts/${cartB}/coupons`).set("Authorization", `Bearer ${userB.token}`).send({ code: promo.code });

    const [resA, resB] = await Promise.all([
      request(app).post("/api/v1/orders/checkout").set("Authorization", `Bearer ${userA.token}`).send(checkoutBody({ idempotencyKey: "concurrent-a-key" })),
      request(app).post("/api/v1/orders/checkout").set("Authorization", `Bearer ${userB.token}`).send(checkoutBody({ idempotencyKey: "concurrent-b-key" })),
    ]);

    const results = [resA, resB];
    const successes = results.filter((r) => r.status === 201);
    const rejections = results.filter((r) => r.status === 422 && r.body.error.code === "TOTAL_USAGE_LIMIT_REACHED");

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);

    const refreshedPromo = await prisma.promotion.findUnique({ where: { id: promo.id } });
    expect(refreshedPromo.currentUsage).toBe(1);

    const redemptionCount = await prisma.redemption.count({ where: { promotionId: promo.id } });
    expect(redemptionCount).toBe(1);
  });
});
