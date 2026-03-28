import { AppError } from "../utils/appError.js";

const isJsonSyntaxError = (error) =>
  error instanceof SyntaxError && error.status === 400 && "body" in error;

export const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

export const errorHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  let statusCode = error?.statusCode || error?.status || 500;
  let message = error?.message || "Internal server error";
  let details = error?.details || null;

  if (isJsonSyntaxError(error)) {
    statusCode = 400;
    message = "Invalid JSON payload";
    details = ["Request body must be valid JSON"];
  } else if (error?.message === "Origin not allowed by CORS") {
    statusCode = 403;
    message = "Origin not allowed";
  }

  if (statusCode >= 500) {
    console.error("Unhandled server error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    details,
  });
};
