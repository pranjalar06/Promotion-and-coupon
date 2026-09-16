const express = require("express");
const cors = require("cors");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./auth/auth.routes");
const categoriesRoutes = require("./categories/categories.routes");
const productsRoutes = require("./products/products.routes");
const cartsRoutes = require("./carts/carts.routes");
const promotionsRoutes = require("./promotions/promotions.routes");
const ordersRoutes = require("./orders/orders.routes");
const adminRoutes = require("./admin/admin.routes");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoriesRoutes);
app.use("/api/v1/products", productsRoutes);
app.use("/api/v1/carts", cartsRoutes);
app.use("/api/v1/promotions", promotionsRoutes);
app.use("/api/v1/orders", ordersRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
