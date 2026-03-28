import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { buildGroupChatId } from "../models/message.model.js";
import { formatMessageListResponse, getGroupMessagesPage, searchMessagesInChat } from "../services/message.service.js";
import {
  emitGroupChatCleared,
  emitGroupDeleted,
  emitGroupMessage,
  emitGroupRemoved,
  emitGroupUpdated,
} from "../socket/socket.service.js";

export const createGroup = async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;
    const currentUserId = req.user._id.toString();

    if (!name?.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const uniqueMembers = Array.from(new Set([currentUserId, ...memberIds.map(String)]));
    if (uniqueMembers.length < 2) {
      return res.status(400).json({ message: "Group must include at least 2 members" });
    }

    const group = await Group.create({
      name: name.trim(),
      admin: req.user._id,
      members: uniqueMembers,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName email profilePic")
      .populate("admin", "fullName email profilePic");
    return res.status(201).json(populatedGroup);
  } catch (error) {
    console.error("Error in createGroup:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const myId = req.user._id;
    const groups = await Group.find({ members: myId })
      .sort({ updatedAt: -1 })
      .populate("members", "fullName email profilePic")
      .populate("admin", "fullName email profilePic");

    return res.status(200).json(groups);
  } catch (error) {
    console.error("Error in getMyGroups:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const myId = req.user._id;
    const { groupId } = req.params;
    const query = req.validatedQuery || req.query;

    const group = await Group.findOne({ _id: groupId, members: myId }).select("_id");
    if (!group) {
      return res.status(403).json({ message: "Not authorized for this group" });
    }

    const result = await getGroupMessagesPage({ groupId, query });
    return res.status(200).json(formatMessageListResponse(result, query));
  } catch (error) {
    console.error("Error in getGroupMessages:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const searchGroupMessages = async (req, res) => {
  try {
    const myId = req.user._id;
    const { groupId } = req.params;
    const { q, limit, mode } = req.validatedQuery || req.query;

    const group = await Group.findOne({ _id: groupId, members: myId }).select("_id");
    if (!group) {
      return res.status(403).json({ message: "Not authorized for this group" });
    }

    const results = await searchMessagesInChat({
      chatId: buildGroupChatId(groupId),
      query: q,
      limit,
      mode,
    });

    return res.status(200).json(results);
  } catch (error) {
    console.error("Error in searchGroupMessages:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { text, img, image: imageFromBody, clientMessageId } = req.body;
    const senderId = req.user._id;
    const image = imageFromBody || img;

    const group = await Group.findOne({ _id: groupId, members: senderId });
    if (!group) {
      return res.status(403).json({ message: "Not authorized for this group" });
    }

    if (clientMessageId) {
      const existingMessage = await Message.findOne({
        senderId,
        clientMessageId,
      });

      if (existingMessage) {
        return res.status(200).json(existingMessage);
      }
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      groupId,
      chatType: "group",
      text,
      clientMessageId: clientMessageId || undefined,
      image: imageUrl,
      seen: false,
    });

    emitGroupMessage(group.members, newMessage);
    return res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendGroupMessage:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const myId = req.user._id.toString();

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = group.members.some((memberId) => memberId.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const remainingMembers = group.members.filter((memberId) => memberId.toString() !== myId);
    if (remainingMembers.length === 0) {
      emitGroupDeleted(group.members, groupId);
      await Message.deleteMany({ groupId, chatType: "group" });
      await Group.findByIdAndDelete(groupId);
      return res.status(200).json({ message: "You left and group was deleted", deleted: true });
    }

    group.members = remainingMembers;
    if (group.admin.toString() === myId) {
      group.admin = remainingMembers[0];
    }
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "fullName email profilePic")
      .populate("admin", "fullName email profilePic");
    emitGroupUpdated(updatedGroup.members, updatedGroup);
    emitGroupRemoved(myId, groupId);
    return res.status(200).json({
      message: "Left group successfully",
      deleted: false,
      group: updatedGroup,
    });
  } catch (error) {
    console.error("Error in leaveGroup:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const myId = req.user._id.toString();

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.admin.toString() !== myId) {
      return res.status(403).json({ message: "Only group admin can delete this group" });
    }

    emitGroupDeleted(group.members, groupId);
    await Message.deleteMany({ groupId, chatType: "group" });
    await Group.findByIdAndDelete(groupId);

    return res.status(200).json({ message: "Group deleted successfully", groupId });
  } catch (error) {
    console.error("Error in deleteGroup:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const myId = req.user._id.toString();

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.admin.toString() !== myId) {
      return res.status(403).json({ message: "Only group admin can remove members" });
    }
    if (memberId === myId) {
      return res.status(400).json({ message: "Admin cannot remove self. Use leave group." });
    }

    const isMember = group.members.some((id) => id.toString() === memberId);
    if (!isMember) {
      return res.status(404).json({ message: "Member not found in this group" });
    }

    group.members = group.members.filter((id) => id.toString() !== memberId);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "fullName email profilePic")
      .populate("admin", "fullName email profilePic");

    emitGroupUpdated(updatedGroup.members, updatedGroup);
    emitGroupRemoved(memberId, groupId);

    return res.status(200).json({
      message: "Member removed successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error("Error in removeGroupMember:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const clearGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const myId = req.user._id.toString();

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.admin.toString() !== myId) {
      return res.status(403).json({ message: "Only group admin can clear chat" });
    }

    await Message.deleteMany({ groupId, chatType: "group" });
    emitGroupChatCleared(group.members, groupId);

    return res.status(200).json({ message: "Group chat cleared successfully" });
  } catch (error) {
    console.error("Error in clearGroupMessages:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
