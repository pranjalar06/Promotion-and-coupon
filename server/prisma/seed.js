require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Electronics", slug: "electronics" },
  { name: "Fashion", slug: "fashion" },
  { name: "Home", slug: "home" },
  { name: "Beauty", slug: "beauty" },
  { name: "Grocery", slug: "grocery" },
];

const PRODUCTS = [
  // Electronics
  { name: "Wireless Optical Mouse", sku: "ELEC-001", category: "electronics", price: "699.00", stock: 60, description: "Ergonomic 2.4GHz wireless mouse with adjustable DPI.", image: "https://picsum.photos/seed/elec1/600/600" },
  { name: "Mechanical Keyboard", sku: "ELEC-002", category: "electronics", price: "2499.00", stock: 25, description: "RGB backlit mechanical keyboard with blue switches.", image: "https://picsum.photos/seed/elec2/600/600" },
  { name: "Bluetooth Headphones", sku: "ELEC-003", category: "electronics", price: "3499.00", stock: 40, description: "Over-ear wireless headphones with 30-hour battery life.", image: "https://picsum.photos/seed/elec3/600/600" },
  { name: "27-inch 4K Monitor", sku: "ELEC-004", category: "electronics", price: "24999.00", stock: 12, description: "Ultra HD IPS monitor with HDR support.", image: "https://picsum.photos/seed/elec4/600/600" },
  { name: "Smartphone 128GB", sku: "ELEC-005", category: "electronics", price: "18999.00", stock: 18, description: "6.5-inch AMOLED display, triple camera, 128GB storage.", image: "https://picsum.photos/seed/elec5/600/600" },
  { name: "Portable Power Bank 20000mAh", sku: "ELEC-006", category: "electronics", price: "1499.00", stock: 50, description: "Fast-charging power bank with dual USB output.", image: "https://picsum.photos/seed/elec6/600/600" },
  // Fashion
  { name: "Men's Cotton T-Shirt", sku: "FASH-001", category: "fashion", price: "799.00", stock: 100, description: "Breathable 100% cotton crew neck t-shirt.", image: "https://picsum.photos/seed/fash1/600/600" },
  { name: "Women's Denim Jacket", sku: "FASH-002", category: "fashion", price: "2199.00", stock: 35, description: "Classic fit denim jacket with button closure.", image: "https://picsum.photos/seed/fash2/600/600" },
  { name: "Running Shoes", sku: "FASH-003", category: "fashion", price: "3199.00", stock: 45, description: "Lightweight cushioned running shoes.", image: "https://picsum.photos/seed/fash3/600/600" },
  { name: "Leather Wallet", sku: "FASH-004", category: "fashion", price: "999.00", stock: 70, description: "Genuine leather bifold wallet with card slots.", image: "https://picsum.photos/seed/fash4/600/600" },
  // Home
  { name: "Non-stick Cookware Set", sku: "HOME-001", category: "home", price: "3499.00", stock: 20, description: "5-piece non-stick cookware set with lids.", image: "https://picsum.photos/seed/home1/600/600" },
  { name: "LED Desk Lamp", sku: "HOME-002", category: "home", price: "899.00", stock: 55, description: "Adjustable brightness LED desk lamp with USB port.", image: "https://picsum.photos/seed/home2/600/600" },
  { name: "Cotton Bedsheet Set", sku: "HOME-003", category: "home", price: "1299.00", stock: 40, description: "King-size cotton bedsheet with two pillow covers.", image: "https://picsum.photos/seed/home3/600/600" },
  { name: "Ceramic Dinner Set", sku: "HOME-004", category: "home", price: "2799.00", stock: 15, description: "16-piece ceramic dinner set for 4.", image: "https://picsum.photos/seed/home4/600/600" },
  // Beauty
  { name: "Face Moisturizer 100ml", sku: "BEAU-001", category: "beauty", price: "499.00", stock: 80, description: "Lightweight daily moisturizer for all skin types.", image: "https://picsum.photos/seed/beau1/600/600" },
  { name: "Herbal Shampoo 340ml", sku: "BEAU-002", category: "beauty", price: "349.00", stock: 90, description: "Sulfate-free herbal shampoo for daily use.", image: "https://picsum.photos/seed/beau2/600/600" },
  { name: "Matte Lipstick", sku: "BEAU-003", category: "beauty", price: "599.00", stock: 65, description: "Long-lasting matte finish lipstick.", image: "https://picsum.photos/seed/beau3/600/600" },
  // Grocery
  { name: "Organic Basmati Rice 5kg", sku: "GROC-001", category: "grocery", price: "649.00", stock: 30, description: "Premium aged organic basmati rice.", image: "https://picsum.photos/seed/groc1/600/600" },
  { name: "Cold Pressed Olive Oil 1L", sku: "GROC-002", category: "grocery", price: "899.00", stock: 25, description: "Extra virgin cold pressed olive oil.", image: "https://picsum.photos/seed/groc2/600/600" },
  { name: "Assorted Dry Fruits Pack 1kg", sku: "GROC-003", category: "grocery", price: "1099.00", stock: 20, description: "Premium mix of almonds, cashews and raisins.", image: "https://picsum.photos/seed/groc3/600/600" },
];

async function main() {
  console.log("Seeding categories...");
  const categoryBySlug = {};
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, active: true },
      create: { name: c.name, slug: c.slug, active: true },
    });
    categoryBySlug[c.slug] = category;
  }

  console.log("Seeding products...");
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        stock: p.stock,
        active: true,
        categoryId: categoryBySlug[p.category].id,
      },
      create: {
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        stock: p.stock,
        sku: p.sku,
        active: true,
        categoryId: categoryBySlug[p.category].id,
      },
    });
  }

  console.log("Seeding promotions...");
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);
  const oneMonthAhead = new Date(now);
  oneMonthAhead.setMonth(now.getMonth() + 1);
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(now.getMonth() - 2);
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);

  await prisma.promotion.upsert({
    where: { code: "SAVE20" },
    update: {},
    create: {
      code: "SAVE20",
      name: "Save 20% Sitewide",
      discountType: "PERCENTAGE",
      discountValue: "20.00",
      maximumDiscount: "500.00",
      minimumOrderValue: "300.00",
      appliesToAllCategories: true,
      status: "ACTIVE",
      startAt: oneMonthAgo,
      endAt: oneMonthAhead,
      totalUsageLimit: 100,
      perUserUsageLimit: 1,
    },
  });

  const techPromo = await prisma.promotion.upsert({
    where: { code: "TECH20" },
    update: {},
    create: {
      code: "TECH20",
      name: "20% Off Electronics",
      discountType: "PERCENTAGE",
      discountValue: "20.00",
      maximumDiscount: "1000.00",
      minimumOrderValue: "1000.00",
      appliesToAllCategories: false,
      status: "ACTIVE",
      startAt: oneMonthAgo,
      endAt: oneMonthAhead,
      totalUsageLimit: 50,
      perUserUsageLimit: 1,
    },
  });
  await prisma.promotionCategory.upsert({
    where: { promotionId_categoryId: { promotionId: techPromo.id, categoryId: categoryBySlug.electronics.id } },
    update: {},
    create: { promotionId: techPromo.id, categoryId: categoryBySlug.electronics.id },
  });

  await prisma.promotion.upsert({
    where: { code: "FLAT100" },
    update: {},
    create: {
      code: "FLAT100",
      name: "Flat ₹100 Off",
      discountType: "FLAT",
      discountValue: "100.00",
      maximumDiscount: null,
      minimumOrderValue: "1000.00",
      appliesToAllCategories: true,
      status: "ACTIVE",
      startAt: oneMonthAgo,
      endAt: oneMonthAhead,
      totalUsageLimit: 100,
      perUserUsageLimit: null,
    },
  });

  await prisma.promotion.upsert({
    where: { code: "EXPIRED20" },
    update: {},
    create: {
      code: "EXPIRED20",
      name: "Expired 20% Promo",
      discountType: "PERCENTAGE",
      discountValue: "20.00",
      maximumDiscount: "500.00",
      minimumOrderValue: "0.00",
      appliesToAllCategories: true,
      status: "ACTIVE",
      startAt: twoMonthsAgo,
      endAt: oneWeekAgo,
      totalUsageLimit: null,
      perUserUsageLimit: null,
    },
  });

  console.log("Seeding admin account...");
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@promo.test").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345";
  const adminName = process.env.ADMIN_NAME || "Store Admin";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { name: adminName, email: adminEmail, passwordHash, role: "ADMIN" },
  });
  await prisma.cart.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  console.log("Seed complete.");
  console.log(`Admin login -> email: ${adminEmail} / password: ${adminPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
