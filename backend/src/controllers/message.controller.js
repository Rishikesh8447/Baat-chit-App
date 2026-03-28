import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import {
  formatMessageListResponse,
  getDirectMessagesPage,
  getSidebarMessageMeta,
  searchMessagesInChat,
} from "../services/message.service.js";
import { buildDirectChatId } from "../models/message.model.js";
import {
  emitDirectChatCleared,
  emitDirectMessage,
  emitMessageDeleted,
  emitMessageUpdated,
} from "../socket/socket.service.js";
export const getUsersForSidebar=async(req,res)=>{
try {
    const LoggedInUserId=req.user._id;
    const filteredUsers=await User.find({_id:{$ne:LoggedInUserId}}).select("-password");
    const sidebarMeta = await getSidebarMessageMeta(LoggedInUserId);
    const byUser = new Map(sidebarMeta.map((item) => [item.otherUserId, item]));

    const usersWithMeta = filteredUsers.map((user) => {
      const meta = byUser.get(user._id.toString());
      return {
        ...user.toObject(),
        unreadCount: meta?.unreadCount || 0,
        lastMessage: meta?.lastMessage || "",
        lastMessageAt: meta?.lastMessageAt || null,
      };
    });

    usersWithMeta.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    res.status(200).json(usersWithMeta);

} catch (error) {
    console.error("Error in getUsersForSidebar:",error.message);
    res.status(500).json({error:"Internal server error"});
}
};

export const searchDirectMessages = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: otherUserId } = req.params;
    const { q, limit, mode } = req.validatedQuery || req.query;

    const results = await searchMessagesInChat({
      chatId: buildDirectChatId(myId, otherUserId),
      query: q,
      limit,
      mode,
    });

    return res.status(200).json(results);
  } catch (error) {
    console.error("Error in searchDirectMessages:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessages=async(req,res)=>{
    try {
     const {id:UserToChatId}  =req.params 
     const myId=req.user._id;
     const query = req.validatedQuery || req.query;

     const result = await getDirectMessagesPage({
        currentUserId: myId,
        otherUserId: UserToChatId,
        query,
     });

     res.status(200).json(formatMessageListResponse(result, query))
    } catch (error) {
        console.log("Error in getMessage Controller:",error.message);
        res.status(500).json({error:"Internal server error"});
    }
};
export const sendMessage=async(req,res)=>{
    try {
        const{text,img,image:imageFromBody, clientMessageId}=req.body;
        const {id:receiverId}=req.params;
        const senderId=req.user._id;
        const image = imageFromBody || img;

        if (clientMessageId) {
          const existingMessage = await Message.findOne({
            senderId,
            clientMessageId,
          });

          if (existingMessage) {
            return res.status(200).json(existingMessage);
          }
        }

        let  imageUrl;  

        if(image){
// upload Base64 image to cloudinary
        const uploadResponse=await cloudinary.uploader.upload(image);
        imageUrl=uploadResponse.secure_url;
        }

        const newMessage= new Message({
            senderId,
            receiverId,
            chatType: "direct",
            text,
            clientMessageId: clientMessageId || undefined,
            image:imageUrl,
            seen: false,
        });

        await newMessage.save();

        emitDirectMessage(receiverId, newMessage);

res.status(201).json(newMessage);
            } catch (error) {
        console.log("Error in send messsage controller:", error.message);
        res.status(500).json({error:"Internal server error"});
    }
}

export const markMessagesAsSeen = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: senderId } = req.params;

    const result = await Message.updateMany(
      {
        senderId,
        receiverId: myId,
        seen: { $ne: true },
      },
      {
        $set: { seen: true, seenAt: new Date() },
      }
    );

    res.status(200).json({ updatedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error in markMessagesAsSeen:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const myId = req.user._id.toString();
    const { id: messageId } = req.params;
    const { text } = req.body;

    const trimmedText = (text || "").trim();
    if (!trimmedText) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== myId) {
      return res.status(403).json({ message: "You can edit only your own messages" });
    }
    if (message.isDeleted) {
      return res.status(400).json({ message: "Deleted messages cannot be edited" });
    }

    message.text = trimmedText;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();
    await emitMessageUpdated(message);

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error in editMessage:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const myId = req.user._id.toString();
    const { id: messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== myId) {
      return res.status(403).json({ message: "You can delete only your own messages" });
    }

    message.text = "";
    message.image = "";
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();
    await emitMessageDeleted(message);

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const clearDirectChat = async (req, res) => {
  try {
    const myId = req.user._id.toString();
    const { id: otherUserId } = req.params;

    await Message.deleteMany({
      $or: [
        { senderId: myId, receiverId: otherUserId, chatType: "direct" },
        { senderId: otherUserId, receiverId: myId, chatType: "direct" },
        { senderId: myId, receiverId: otherUserId, chatType: { $exists: false } },
        { senderId: otherUserId, receiverId: myId, chatType: { $exists: false } },
      ],
    });
    emitDirectChatCleared({ userA: myId, userB: otherUserId });

    return res.status(200).json({ message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Error in clearDirectChat:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
