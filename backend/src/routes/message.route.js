import express from "express";
import {protectRoute} from "../middlewares/auth.middleware.js";
import {
  deleteMessage,
  editMessage,
  getUsersForSidebar,
  getMessages,
  markMessagesAsSeen,
  sendMessage,
} from "../controllers/message.controller.js";

const router=express.Router();


router.get("/users", protectRoute,getUsersForSidebar);

router.get("/:id",protectRoute,getMessages);

router.post("/send/:id",protectRoute,sendMessage)
router.put("/seen/:id", protectRoute, markMessagesAsSeen);
router.patch("/:id", protectRoute, editMessage);
router.delete("/:id", protectRoute, deleteMessage);

export default router; 
