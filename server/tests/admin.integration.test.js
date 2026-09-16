const {
  request,
  app,
  prisma,
  resetDb,
  signup,
  makeAdmin,
  createCategory,
  createProduct,
  getMyCartId,
} = require("./helpers");

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

async function adminClient() {
  const { token, user } = await signup({ email: `admin${Date.now()}${Math.random()}@test.com` });
  await makeAdmin(user.id);
  return token;
}

describe("Admin promotion management", () => {
  test("rejects an invalid promotion (bad percentage, missing dates)", async () => {
    const token = await adminClient();
    const res = await request(app)
      .post("/api/v1/admin/promotions")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "BAD1", name: "Bad", discountType: "PERCENTAGE", discountValue: 150 });
    expect(res.status).toBe(422);
  });

  test("requires at least one category in selected-category mode", async () => {
    const token = await adminClient();
    const res = await request(app)
      .post("/api/v1/admin/promotions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: "NEEDSCAT",
        name: "Needs category",
        discountType: "FLAT",
        discountValue: 50,
        appliesToAllCategories: false,
        categoryIds: [],
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(res.status).toBe(422);
  });

  test("creates a promotion that a customer can immediately use", async () => {
    const token = await adminClient();
    const category = await createCategory({ name: "Beauty", slug: "beauty-admintest" });
    const product = await createProduct(category.id, { price: "2000.00" });

    const createRes = await request(app)
      .post("/api/v1/admin/promotions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: "NEWPROMO15",
        name: "New Promo",
        discountType: "PERCENTAGE",
        discountValue: 15,
        maximumDiscount: 400,
        minimumOrderValue: 1500,
        appliesToAllCategories: false,
        categoryIds: [category.id],
        startAt: new Date(Date.now() - 1000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        totalUsageLimit: 10,
        perUserUsageLimit: 1,
        status: "ACTIVE",
      });
    expect(createRes.status).toBe(201);

    const listRes = await request(app).get("/api/v1/admin/promotions").set("Authorization", `Bearer ${token}`);
    expect(listRes.body.promotions.some((p) => p.code === "NEWPROMO15")).toBe(true);

    const { token: customerToken } = await signup({ email: "shopper@test.com" });
    const cartId = await getMyCartId(customerToken);
    await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ productId: product.id, quantity: 1 });

    const applyRes = await request(app)
      .post(`/api/v1/carts/${cartId}/coupons`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code: "NEWPROMO15" });
    expect(applyRes.status).toBe(200);
    expect(applyRes.body.discount).toBe("300.00");
  });

  test("pausing a promotion blocks new applications", async () => {
    const token = await adminClient();
    const category = await createCategory();
    const product = await createProduct(category.id, { price: "2000.00" });

    const createRes = await request(app)
      .post("/api/v1/admin/promotions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: "PAUSEME",
        name: "Pause me",
        discountType: "FLAT",
        discountValue: 100,
        appliesToAllCategories: true,
        startAt: new Date(Date.now() - 1000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
      });
    const promotionId = createRes.body.promotion.id;

    await request(app).post(`/api/v1/admin/promotions/${promotionId}/pause`).set("Authorization", `Bearer ${token}`);

    const { token: customerToken } = await signup({ email: "shopper2@test.com" });
    const cartId = await getMyCartId(customerToken);
    await request(app)
      .post(`/api/v1/carts/${cartId}/items`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ productId: product.id, quantity: 1 });
    const applyRes = await request(app)
      .post(`/api/v1/carts/${cartId}/coupons`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code: "PAUSEME" });
    expect(applyRes.status).toBe(422);
    expect(applyRes.body.error.code).toBe("PROMOTION_INACTIVE");
  });

  test("dashboard reflects real promotion and redemption counts", async () => {
    const token = await adminClient();
    const before = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${token}`);
    const baselineTotal = before.body.dashboard.totalPromotions;

    await request(app)
      .post("/api/v1/admin/promotions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: "DASHTEST",
        name: "Dash test",
        discountType: "FLAT",
        discountValue: 50,
        appliesToAllCategories: true,
        startAt: new Date(Date.now() - 1000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
      });

    const after = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${token}`);
    expect(after.body.dashboard.totalPromotions).toBe(baselineTotal + 1);
    expect(after.body.dashboard.activePromotions).toBeGreaterThanOrEqual(1);
  });
});
