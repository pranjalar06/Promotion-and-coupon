const { request, app, prisma, resetDb, signup, makeAdmin, getMyCartId, addToCart, createCategory, createProduct } = require("./helpers");

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("Authorization and ownership (IDOR protection)", () => {
  test("a USER cannot access the admin dashboard", async () => {
    const { token } = await signup({ email: "user1@test.com" });
    const res = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("a USER cannot create a promotion via the admin API", async () => {
    const { token } = await signup({ email: "user2@test.com" });
    const res = await request(app)
      .post("/api/v1/admin/promotions")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "HACK10", name: "Hack", discountType: "FLAT", discountValue: 10, startAt: new Date(), endAt: new Date(Date.now() + 86400000) });
    expect(res.status).toBe(403);
  });

  test("requests without a token are rejected with 401", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard");
    expect(res.status).toBe(401);
  });

  test("an ADMIN-role user passes the admin guard", async () => {
    const { token, user } = await signup({ email: "willbeadmin@test.com" });
    await makeAdmin(user.id);
    const res = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test("a user cannot view another user's cart", async () => {
    const userA = await signup({ email: "cartowner@test.com" });
    const userB = await signup({ email: "cartintruder@test.com" });
    const cartAId = await getMyCartId(userA.token);

    const res = await request(app).get(`/api/v1/carts/${cartAId}`).set("Authorization", `Bearer ${userB.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CART_ACCESS_DENIED");
  });

  test("a user cannot add items to another user's cart", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id);
    const userA = await signup({ email: "victim@test.com" });
    const userB = await signup({ email: "attacker@test.com" });
    const cartAId = await getMyCartId(userA.token);

    const res = await request(app)
      .post(`/api/v1/carts/${cartAId}/items`)
      .set("Authorization", `Bearer ${userB.token}`)
      .send({ productId: product.id, quantity: 1 });
    expect(res.status).toBe(403);
  });

  test("a user cannot view another user's order", async () => {
    const category = await createCategory();
    const product = await createProduct(category.id);
    const userA = await signup({ email: "orderowner@test.com" });
    const userB = await signup({ email: "orderintruder@test.com" });

    const cartId = await addToCart(userA.token, product.id, 1);
    const checkoutRes = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${userA.token}`)
      .send({
        customerName: "A",
        customerEmail: "a@test.com",
        customerAddress: "123 Street",
        paymentOutcome: "SUCCESS",
        idempotencyKey: `key-${cartId}`,
      });
    expect(checkoutRes.status).toBe(201);
    const orderId = checkoutRes.body.order.id;

    const res = await request(app).get(`/api/v1/orders/${orderId}`).set("Authorization", `Bearer ${userB.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORDER_ACCESS_DENIED");
  });
});
