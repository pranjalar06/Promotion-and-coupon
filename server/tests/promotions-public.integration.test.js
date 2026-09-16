const { request, app, prisma, resetDb, signup, createPromotion } = require("./helpers");

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("GET /api/v1/promotions (public listing)", () => {
  test("requires authentication", async () => {
    const res = await request(app).get("/api/v1/promotions");
    expect(res.status).toBe(401);
  });

  test("lists active, currently-valid, non-exhausted promotions", async () => {
    await createPromotion({ code: "VISIBLE1" });
    await createPromotion({ code: "PAUSEDONE", status: "PAUSED" });
    await createPromotion({
      code: "EXPIREDONE",
      startAt: new Date(Date.now() - 20 * 86400000),
      endAt: new Date(Date.now() - 10 * 86400000),
    });
    await createPromotion({
      code: "NOTSTARTEDONE",
      startAt: new Date(Date.now() + 10 * 86400000),
      endAt: new Date(Date.now() + 20 * 86400000),
    });
    await createPromotion({ code: "EXHAUSTEDONE", totalUsageLimit: 1, currentUsage: 1 });

    const { token } = await signup();
    const res = await request(app).get("/api/v1/promotions").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const codes = res.body.promotions.map((p) => p.code);
    expect(codes).toContain("VISIBLE1");
    expect(codes).not.toContain("PAUSEDONE");
    expect(codes).not.toContain("EXPIREDONE");
    expect(codes).not.toContain("NOTSTARTEDONE");
    expect(codes).not.toContain("EXHAUSTEDONE");
  });

  test("does not expose currentUsage or perUserUsageLimit", async () => {
    await createPromotion({ code: "NOINTERNALS", totalUsageLimit: 10, perUserUsageLimit: 1 });
    const { token } = await signup();
    const res = await request(app).get("/api/v1/promotions").set("Authorization", `Bearer ${token}`);
    const promo = res.body.promotions.find((p) => p.code === "NOINTERNALS");
    expect(promo).toBeTruthy();
    expect(promo).not.toHaveProperty("currentUsage");
    expect(promo).not.toHaveProperty("perUserUsageLimit");
    expect(promo).not.toHaveProperty("totalUsageLimit");
  });
});
