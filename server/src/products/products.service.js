const prisma = require("../database/prisma");
const AppError = require("../utils/AppError");
const { toMoneyString } = require("../utils/money");

function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: toMoneyString(product.price),
    image: product.image,
    stock: product.stock,
    sku: product.sku,
    inStock: product.stock > 0,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
  };
}

async function listProducts({ categorySlug } = {}) {
  const where = {
    active: true,
    category: { active: true },
  };
  if (categorySlug && categorySlug !== "all") {
    where.category = { active: true, slug: categorySlug };
  }
  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return products.map(serializeProduct);
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!product || !product.active || !product.category || !product.category.active) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "This product is not available.");
  }
  return serializeProduct(product);
}

module.exports = { listProducts, getProductById, serializeProduct };
