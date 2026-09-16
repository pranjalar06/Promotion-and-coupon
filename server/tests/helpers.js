const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/database/prisma");

async function resetDb() {
  await prisma.idempotencyKey.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.promotionCategory.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

async function createCategory(overrides = {}) {
  return prisma.category.create({
    data: { name: "Electronics", slug: `cat-${uniqueSuffix()}`, active: true, ...overrides },
  });
}

async function createProduct(categoryId, overrides = {}) {
  return prisma.product.create({
    data: {
      name: "Test Product",
      description: "A test product",
      price: "1000.00",
      image: "https://example.com/x.png",
      stock: 100,
      sku: `SKU-${uniqueSuffix()}`,
      active: true,
      categoryId,
      ...overrides,
    },
  });
}

async function createPromotion(overrides = {}) {
  const { categoryIds, ...rest } = overrides;
  return prisma.promotion.create({
    data: {
      code: `CODE${uniqueSuffix()}`,
      name: "Test Promo",
      discountType: "PERCENTAGE",
      discountValue: "10.00",
      minimumOrderValue: "0.00",
      appliesToAllCategories: true,
      status: "ACTIVE",
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000),
      ...rest,
      ...(categoryIds ? { categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } } : {}),
    },
  });
}

async function signup(overrides = {}) {
  const email = overrides.email || `user${uniqueSuffix()}@test.com`;
  const password = overrides.password || "Password123";
  const res = await request(app)
    .post("/api/v1/auth/signup")
    .send({ name: overrides.name || "Test User", email, password, confirmPassword: password });
  return { status: res.status, body: res.body, token: res.body.token, user: res.body.user, email, password };
}

async function makeAdmin(userId) {
  return prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
}

async function getMyCartId(token) {
  const res = await request(app).get("/api/v1/carts/me").set("Authorization", `Bearer ${token}`);
  return res.body.cart.id;
}

async function addToCart(token, productId, quantity = 1) {
  const cartId = await getMyCartId(token);
  await request(app)
    .post(`/api/v1/carts/${cartId}/items`)
    .set("Authorization", `Bearer ${token}`)
    .send({ productId, quantity });
  return cartId;
}

module.exports = {
  app,
  request,
  prisma,
  resetDb,
  uniqueSuffix,
  createCategory,
  createProduct,
  createPromotion,
  signup,
  makeAdmin,
  getMyCartId,
  addToCart,
};
