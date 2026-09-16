const asyncHandler = require("../utils/asyncHandler");
const authService = require("./auth.service");
const prisma = require("../database/prisma");
const AppError = require("../utils/AppError");

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body || {});
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body || {});
  res.status(200).json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  res.json({ user: authService.sanitizeUser(user) });
});

module.exports = { signup, login, me };
