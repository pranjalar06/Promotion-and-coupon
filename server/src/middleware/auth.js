const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const prisma = require("../database/prisma");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication token is required.");
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      throw new AppError(401, "INVALID_TOKEN", "Authentication token is invalid or expired.");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "User no longer exists.");
    }

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(role) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(new AppError(401, "UNAUTHENTICATED", "Authentication is required."));
    }
    if (req.user.role !== role) {
      return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
