import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import {
  clearGroupMessages,
  createGroup,
  deleteGroup,
  getGroupMessages,
  getMyGroups,
  leaveGroup,
  removeGroupMember,
  searchGroupMessages,
  sendGroupMessage,
} from "../controllers/group.controller.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { env } from "../config/env.js";
import {
  validateCreateGroup,
  validateGroupMessage,
  validateObjectIdParams,
  validatePaginationQuery,
  validateSearchQuery,
} from "../utils/validation.js";

const router = express.Router();
const messageLimiter = rateLimit({
  key: "group-message-send",
  windowMs: env.messageRateLimitWindowMs,
  max: env.messageRateLimitMax,
  message: "Too many messages sent too quickly",
});

router.post("/", protectRoute, validate(validateCreateGroup), createGroup);
router.get("/", protectRoute, getMyGroups);
router.get("/:groupId/search", protectRoute, validate(validateObjectIdParams("groupId")), validate(validateSearchQuery), searchGroupMessages);
router.get("/:groupId/messages", protectRoute, validate(validateObjectIdParams("groupId")), validate(validatePaginationQuery), getGroupMessages);
router.post("/:groupId/messages", protectRoute, messageLimiter, validate(validateGroupMessage), sendGroupMessage);
router.delete("/:groupId/messages", protectRoute, validate(validateObjectIdParams("groupId")), clearGroupMessages);
router.post("/:groupId/leave", protectRoute, validate(validateObjectIdParams("groupId")), leaveGroup);
router.delete("/:groupId", protectRoute, validate(validateObjectIdParams("groupId")), deleteGroup);
router.delete("/:groupId/members/:memberId", protectRoute, validate(validateObjectIdParams("groupId", "memberId")), removeGroupMember);

export default router;
