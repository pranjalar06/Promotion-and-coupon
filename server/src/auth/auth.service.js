const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../database/prisma");
const AppError = require("../utils/AppError");
const { log } = require("../utils/logger");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function signup({ name, email, password, confirmPassword }) {
  if (!name || !name.trim()) throw new AppError(422, "VALIDATION_ERROR", "Name is required.");
  if (!email || !EMAIL_RE.test(email)) throw new AppError(422, "VALIDATION_ERROR", "A valid email is required.");
  if (!password || password.length < 8) {
    throw new AppError(422, "VALIDATION_ERROR", "Password must be at least 8 characters.");
  }
  if (password !== confirmPassword) {
    throw new AppError(422, "VALIDATION_ERROR", "Passwords do not match.");
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name: name.trim(), email: email.toLowerCase(), passwordHash, role: "USER" },
    });
    await tx.cart.create({ data: { userId: created.id } });
    return created;
  });

  log("auth.signup.success", { userId: user.id });
  return { token: signToken(user), user: sanitizeUser(user) };
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError(422, "VALIDATION_ERROR", "Email and password are required.");
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  log("auth.login.success", { userId: user.id });
  return { token: signToken(user), user: sanitizeUser(user) };
}

module.exports = { signup, login, sanitizeUser };
