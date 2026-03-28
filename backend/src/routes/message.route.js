import express from "express";
import {protectRoute} from "../middlewares/auth.middleware.js";
import {
  clearDirectChat,
  deleteMessage,
  editMessage,
  getUsersForSidebar,
  getMessages,
  markMessagesAsSeen,
  searchDirectMessages,
  sendMessage,
} from "../controllers/message.controller.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { env } from "../config/env.js";
import {
  validateEditMessage,
  validateObjectIdParams,
  validatePaginationQuery,
  validateSearchQuery,
  validateSendMessage,
} from "../utils/validation.js";

const router=express.Router();
const messageLimiter = rateLimit({
  key: "message-send",
  windowMs: env.messageRateLimitWindowMs,
  max: env.messageRateLimitMax,
  message: "Too many messages sent too quickly",
});


router.get("/users", protectRoute,getUsersForSidebar);
router.get("/search/:id", protectRoute, validate(validateObjectIdParams("id")), validate(validateSearchQuery), searchDirectMessages);

router.get("/:id",protectRoute, validate(validateObjectIdParams("id")), validate(validatePaginationQuery), getMessages);

router.post("/send/:id",protectRoute, messageLimiter, validate(validateSendMessage), sendMessage)
router.put("/seen/:id", protectRoute, validate(validateObjectIdParams("id")), markMessagesAsSeen);
router.delete("/chat/:id", protectRoute, validate(validateObjectIdParams("id")), clearDirectChat);
router.patch("/:id", protectRoute, validate(validateEditMessage), editMessage);
router.delete("/:id", protectRoute, validate(validateObjectIdParams("id")), deleteMessage);

export default router; 
