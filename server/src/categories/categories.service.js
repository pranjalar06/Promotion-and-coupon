const prisma = require("../database/prisma");

async function listActiveCategories() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

async function listAllCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

module.exports = { listActiveCategories, listAllCategories };
