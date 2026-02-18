import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
export const getUsersForSidebar=async(req,res)=>{
try {
    const LoggedInUserId=req.user._id;
    const filteredUsers=await User.find({_id:{$ne:LoggedInUserId}}).select("-password");
    const messages = await Message.find({
      $and: [
        { $or: [{ senderId: LoggedInUserId }, { receiverId: LoggedInUserId }] },
        { $or: [{ chatType: "direct" }, { chatType: { $exists: false } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .select("senderId receiverId text image createdAt seen isDeleted");

    const byUser = new Map();

    for (const msg of messages) {
      const senderId = msg.senderId.toString();
      const receiverId = msg.receiverId.toString();
      const isMine = senderId === LoggedInUserId.toString();
      const otherUserId = isMine ? receiverId : senderId;

      if (!byUser.has(otherUserId)) {
        const lastMessage = msg.isDeleted
          ? "Message deleted"
          : msg.text?.trim()
            ? msg.text
            : msg.image
              ? "Image"
              : "";
        byUser.set(otherUserId, {
          lastMessage,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
        });
      }

      if (!isMine && !msg.seen) {
        const current = byUser.get(otherUserId);
        current.unreadCount += 1;
      }
    }

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

export const getMessages=async(req,res)=>{
    try {
     const {id:UserToChatId}  =req.params 
     const myId=req.user._id;

     const messages=await Message.find({$or:[{
        senderId:myId,receiverId:UserToChatId
     },{senderId:UserToChatId,receiverId:myId}
    ]})
      .where("chatType")
      .in(["direct", null])
     res.status(200).json(messages)
    } catch (error) {
        console.log("Error in getMessage Controller:",error.message);
        res.status(500).json({error:"Internal server error"});
    }
};
export const sendMessage=async(req,res)=>{
    try {
        const{text,img,image:imageFromBody}=req.body;
        const {id:receiverId}=req.params;
        const senderId=req.user._id;
        const image = imageFromBody || img;

        let  imageUrl;  

        if(image){
// upload Base64 image to cloudinary
        const uploadResponse=await cloudinary.uploader.upload(image);
        imageUrl=uploadResponse.secure_url;
        }

        const newMessage= new Message({
            senderId,
            receiverId,
            text,
            image:imageUrl,
            seen: false,
        });

        await newMessage.save();

        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newMessage", newMessage);
        }

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

const senderSocketId = getReceiverSocketId(message.senderId.toString());
    if (message.chatType === "group" && message.groupId) {
      const group = await Group.findById(message.groupId).select("members");
      if (group) {
        group.members.forEach((memberId) => {
          const socketId = getReceiverSocketId(memberId.toString());
          if (socketId) io.to(socketId).emit("messageUpdated", message);
        });
      }
    } else {
      const receiverSocketId = message.receiverId
        ? getReceiverSocketId(message.receiverId.toString())
        : null;
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageUpdated", message);
      }
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageUpdated", message);
      }
    }

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

const senderSocketId = getReceiverSocketId(message.senderId.toString());
    if (message.chatType === "group" && message.groupId) {
      const group = await Group.findById(message.groupId).select("members");
      if (group) {
        group.members.forEach((memberId) => {
          const socketId = getReceiverSocketId(memberId.toString());
          if (socketId) io.to(socketId).emit("messageDeleted", message);
        });
      }
    } else {
      const receiverSocketId = message.receiverId
        ? getReceiverSocketId(message.receiverId.toString())
        : null;
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDeleted", message);
      }
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageDeleted", message);
      }
    }

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
