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
  sendGroupMessage,
} from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectRoute, createGroup);
router.get("/", protectRoute, getMyGroups);
router.get("/:groupId/messages", protectRoute, getGroupMessages);
router.post("/:groupId/messages", protectRoute, sendGroupMessage);
router.delete("/:groupId/messages", protectRoute, clearGroupMessages);
router.post("/:groupId/leave", protectRoute, leaveGroup);
router.delete("/:groupId", protectRoute, deleteGroup);
router.delete("/:groupId/members/:memberId", protectRoute, removeGroupMember);

export default router;
