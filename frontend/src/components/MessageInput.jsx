import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingContextRef = useRef({
    socket: null,
    authUser: null,
    isTyping: false,
    selectedGroupId: null,
    selectedUserId: null,
  });
  const { sendMessage, selectedUser, selectedGroup, isSendingMessage } = useChatStore();
  const { authUser, socket } = useAuthStore();
  const canSend = Boolean(text.trim() || imagePreview);

  useEffect(() => {
    typingContextRef.current = {
      socket,
      authUser,
      isTyping,
      selectedGroupId: selectedGroup?._id || null,
      selectedUserId: selectedUser?._id || null,
    };
  }, [socket, authUser, isTyping, selectedGroup?._id, selectedUser?._id]);

  const emitStopTyping = useCallback(() => {
    const {
      socket: currentSocket,
      authUser: currentAuthUser,
      isTyping: currentIsTyping,
      selectedGroupId,
      selectedUserId,
    } = typingContextRef.current;

    if (!currentSocket || !currentAuthUser || !currentIsTyping) return;

    const payload = selectedGroupId
      ? {
          chatType: "group",
          groupId: selectedGroupId,
          senderId: currentAuthUser._id,
        }
      : {
          chatType: "direct",
          receiverId: selectedUserId,
          senderId: currentAuthUser._id,
        };

    currentSocket.emit("stopTyping", payload);
    setIsTyping(false);
  }, []);

  const scheduleStopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 1200);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!canSend || isSendingMessage) return;

    try {
      emitStopTyping();
      const sentMessage = await sendMessage({
        text: text.trim(),
        image: imagePreview,
      });
      if (!sentMessage) return;

      setText("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleTextChange = (e) => {
    const nextValue = e.target.value;
    setText(nextValue);

    if (!socket || !authUser) return;

    if (!nextValue.trim()) {
      emitStopTyping();
      return;
    }

    if (!isTyping) {
      const payload = selectedGroup?._id
        ? {
            chatType: "group",
            groupId: selectedGroup._id,
            senderId: authUser._id,
            senderName: authUser.fullName,
          }
        : {
            chatType: "direct",
            receiverId: selectedUser?._id,
            senderId: authUser._id,
            senderName: authUser.fullName,
          };

      socket.emit("typing", payload);
      setIsTyping(true);
    }

    scheduleStopTyping();
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitStopTyping();
    };
  }, [selectedUser?._id, selectedGroup?._id, emitStopTyping]);

  return (
    <div className="p-4 w-full">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            data-testid="message-input"
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md transition-all duration-200"
            placeholder="Type a message..."
            value={text}
            onChange={handleTextChange}
            disabled={isSendingMessage}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
            disabled={isSendingMessage}
          />

          <button
            type="button"
            className={`btn btn-circle btn-sm sm:btn-md
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isSendingMessage}
            title="Attach image"
          >
            <Image size={20} />
          </button>
        </div>
        <button
          data-testid="send-message"
          type="submit"
          className="btn btn-sm sm:btn-md btn-circle transition-all duration-200"
          disabled={!canSend || isSendingMessage}
          title={isSendingMessage ? "Sending message" : "Send message"}
        >
          {isSendingMessage ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>

      {isSendingMessage && (
        <p className="mt-2 text-xs text-base-content/60">Sending message...</p>
      )}
    </div>
  );
};
export default MessageInput;
