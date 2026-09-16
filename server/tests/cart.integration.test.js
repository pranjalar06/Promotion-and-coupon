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
} = require("./helpers");

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

async function addItem(token, cartId, productId, quantity) {
  return request(app)
    .post(`/api/v1/carts/${cartId}/items`)
    .set("Authorization", `Bearer ${token}`)
    .send({ productId, quantity });
}

describe("Cart and coupon application", () => {
  test("adding an item respects stock validation", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { stock: 2 });
    const { token } = await signup();
    const cartId = await getMyCartId(token);

    const res = await addItem(token, cartId, product.id, 5);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PRODUCT_OUT_OF_STOCK");
  });

  test("category-restricted coupon only discounts matching items", async () => {
    const electronics = await createCategory({ name: "Electronics", slug: "electronics-x" });
    const fashion = await createCategory({ name: "Fashion", slug: "fashion-x" });
    const laptop = await createProduct(electronics.id, { name: "Laptop", price: "3000.00" });
    const tshirt = await createProduct(fashion.id, { name: "T-Shirt", price: "800.00" });
    const promo = await createPromotion({
      code: "TECH20X",
      discountType: "PERCENTAGE",
      discountValue: "20.00",
      minimumOrderValue: "1000.00",
      appliesToAllCategories: false,
      categoryIds: [electronics.id],
    });

    const { token } = await signup();
    const cartId = await getMyCartId(token);
    await addItem(token, cartId, laptop.id, 1);
    await addItem(token, cartId, tshirt.id, 1);

    const applyRes = await request(app)
      .post(`/api/v1/carts/${cartId}/coupons`)
      .set("Authorization", `Bearer ${token}`)
      .send({ code: promo.code });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.subtotal).toBe("3800.00");
    expect(applyRes.body.eligibleSubtotal).toBe("3000.00");
    expect(applyRes.body.discount).toBe("600.00");
    expect(applyRes.body.total).toBe("3200.00");
  });

  test("applying a coupon does not consume usage", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "2000.00" });
    const promo = await createPromotion({ code: "NOUSE10", totalUsageLimit: 5 });
    const { token } = await signup();
    const cartId = await getMyCartId(token);
    await addItem(token, cartId, product.id, 1);

    await request(app).post(`/api/v1/carts/${cartId}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });

    const refreshed = await prisma.promotion.findUnique({ where: { id: promo.id } });
    expect(refreshed.currentUsage).toBe(0);
    const redemptions = await prisma.redemption.count({ where: { promotionId: promo.id } });
    expect(redemptions).toBe(0);
  });

  test("minimum order shortfall is reported in structured error data", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "750.00" });
    const promo = await createPromotion({ code: "MIN1000", minimumOrderValue: "1000.00" });
    const { token } = await signup();
    const cartId = await getMyCartId(token);
    await addItem(token, cartId, product.id, 1);

    const res = await request(app).post(`/api/v1/carts/${cartId}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MIN_ORDER_VALUE_NOT_MET");
    expect(res.body.error.data.shortfall).toBe("250.00");
  });

  test("expired coupon is rejected", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id);
    const promo = await createPromotion({
      code: "OLD20",
      startAt: new Date(Date.now() - 20 * 86400000),
      endAt: new Date(Date.now() - 10 * 86400000),
    });
    const { token } = await signup();
    const cartId = await getMyCartId(token);
    await addItem(token, cartId, product.id, 1);

    const res = await request(app).post(`/api/v1/carts/${cartId}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PROMOTION_EXPIRED");
  });

  test("paused coupon is rejected", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id);
    const promo = await createPromotion({ code: "PAUSED1", status: "PAUSED" });
    const { token } = await signup();
    const cartId = await getMyCartId(token);
    await addItem(token, cartId, product.id, 1);

    const res = await request(app).post(`/api/v1/carts/${cartId}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PROMOTION_INACTIVE");
  });

  test("removing a coupon recalculates pricing back to no discount", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "2000.00" });
    const promo = await createPromotion({ code: "REMOVE10", discountValue: "10.00" });
    const { token } = await signup();
    const cartId = await getMyCartId(token);
    await addItem(token, cartId, product.id, 1);
    await request(app).post(`/api/v1/carts/${cartId}/coupons`).set("Authorization", `Bearer ${token}`).send({ code: promo.code });

    const res = await request(app).delete(`/api/v1/carts/${cartId}/coupons/${promo.code}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.discount).toBe("0.00");
    expect(res.body.total).toBe(res.body.subtotal);
    expect(res.body.coupon).toBeNull();
  });
});
