const AppError = require("../utils/AppError");
const { log } = require("../utils/logger");

function notFoundHandler(req, res, next) {
  next(new AppError(404, "ROUTE_NOT_FOUND", "The requested route does not exist."));
}

// Centralized error handler. Never leaks stack traces or raw DB errors to clients.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    log("error.handled", { code: err.code, statusCode: err.statusCode, path: req.path });
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.data ? { data: err.data } : {}),
      },
    });
  }

  if (err && err.code && typeof err.code === "string" && err.code.startsWith("P")) {
    // Prisma error codes (e.g. P2002 unique constraint)
    log("error.database", { prismaCode: err.code, path: req.path });
    if (err.code === "P2002") {
      return res.status(409).json({
        error: { code: "DUPLICATE_ENTRY", message: "A record with this value already exists." },
      });
    }
    return res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "A database error occurred." },
    });
  }

  log("error.unhandled", { message: err.message, path: req.path });
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
}

module.exports = { notFoundHandler, errorHandler };
