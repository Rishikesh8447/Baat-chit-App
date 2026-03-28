import express from "express";
import {
  checkAuth,
  forgotPassword,
  login,
  logout,
  resetPassword,
  signup,
  updateProfile,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { env } from "../config/env.js";
import {
  validateAuthLogin,
  validateAuthSignup,
  validateForgotPassword,
  validateProfileUpdate,
  validateResetPassword,
} from "../utils/validation.js";
const router =express.Router();

const authLimiter = rateLimit({
  key: "auth",
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  message: "Too many authentication attempts, please try again later",
});

router.post("/signup", authLimiter, validate(validateAuthSignup), signup);
router.post("/login", authLimiter, validate(validateAuthLogin), login);
router.post("/logout",logout);
router.post("/forgot-password", authLimiter, validate(validateForgotPassword), forgotPassword);
router.post("/reset-password/:token", authLimiter, validate(validateResetPassword), resetPassword);

router.put("/update-profile",protectRoute, validate(validateProfileUpdate), updateProfile);
router.get("/check",protectRoute,checkAuth);


export default router;
