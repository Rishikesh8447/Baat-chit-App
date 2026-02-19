import { useChatStore } from "../store/useChatStore";
import { useEffect, useMemo, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { Check, ChevronDown, ChevronUp, Pencil, Search, Trash2, X } from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    getGroupMessages,
    markMessagesAsSeen,
    isMessagesLoading,
    selectedUser,
    selectedGroup,
    editMessage,
    deleteMessage,
    clearActiveChat,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("all");
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (selectedGroup?._id) {
      getGroupMessages(selectedGroup._id);
      return;
    }

    if (selectedUser?._id) {
      getMessages(selectedUser._id);
      markMessagesAsSeen(selectedUser._id);
    }
  }, [
    selectedUser?._id,
    selectedGroup?._id,
    getMessages,
    getGroupMessages,
    markMessagesAsSeen,
  ]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchedMessageIds = useMemo(() => {
    return messages
      .filter((message) => {
        const text = (message.text || "").toLowerCase();
        const image = (message.image || "").toLowerCase();
        const hasFile = Boolean(message.image);
        const hasText = Boolean(message.text?.trim());
        const textMatch = normalizedQuery ? text.includes(normalizedQuery) : false;
        const imageMatch = normalizedQuery ? image.includes(normalizedQuery) : false;

        if (searchMode === "text") {
          return normalizedQuery ? textMatch : hasText;
        }
        if (searchMode === "file") {
          return normalizedQuery ? hasFile && (textMatch || imageMatch) : hasFile;
        }
        return normalizedQuery ? textMatch || imageMatch : false;
      })
      .map((message) => message._id);
  }, [messages, normalizedQuery, searchMode]);

  const activeMatchId = activeMatchIndex >= 0 ? matchedMessageIds[activeMatchIndex] : null;
  const matchedMessageSet = useMemo(() => new Set(matchedMessageIds), [matchedMessageIds]);

  useEffect(() => {
    if (!isSearchOpen) {
      setActiveMatchIndex(-1);
      return;
    }
    setActiveMatchIndex(matchedMessageIds.length ? 0 : -1);
  }, [matchedMessageIds, isSearchOpen]);

  useEffect(() => {
    if (!activeMatchId) return;
    const messageEl = document.getElementById(`message-${activeMatchId}`);
    messageEl?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchId]);

  const moveToNextMatch = () => {
    if (!matchedMessageIds.length) return;
    setActiveMatchIndex((prev) => (prev + 1) % matchedMessageIds.length);
  };

  const moveToPrevMatch = () => {
    if (!matchedMessageIds.length) return;
    setActiveMatchIndex((prev) =>
      prev <= 0 ? matchedMessageIds.length - 1 : prev - 1
    );
  };

  const startEditing = (message) => {
    setEditingMessageId(message._id);
    setEditedText(message.text || "");
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditedText("");
  };

  const saveEdit = async (messageId) => {
    if (!editedText.trim()) return;
    await editMessage(messageId, editedText.trim());
    cancelEditing();
  };

  const handleDelete = async (messageId) => {
    await deleteMessage(messageId);
    if (editingMessageId === messageId) {
      cancelEditing();
    }
  };

  const getAvatarForMessage = (message) => {
    if (message.senderId === authUser._id) return authUser.profilePic || "/avatar.png";
    if (selectedGroup?.members?.length) {
      const sender = selectedGroup.members.find((member) => member._id === message.senderId);
      return sender?.profilePic || "/avatar.png";
    }
    return selectedUser?.profilePic || "/avatar.png";
  };

  const adminId =
    typeof selectedGroup?.admin === "object" ? selectedGroup?.admin?._id : selectedGroup?.admin;
  const canClearChat = !selectedGroup?._id || adminId === authUser?._id;

  const handleClearChat = async () => {
    await clearActiveChat();
    setIsClearConfirmOpen(false);
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />
      <div className="border-b border-base-300 px-3 py-2">
        {!isSearchOpen ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="size-4" />
              Find in chat
            </button>
            {canClearChat && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                onClick={() => setIsClearConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Clear chat
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder={searchMode === "file" ? "Search file messages..." : "Search text..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="select select-bordered select-sm"
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value)}
            >
              <option value="all">All</option>
              <option value="text">Text</option>
              <option value="file">Files</option>
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={moveToPrevMatch}>
              <ChevronUp className="size-4" />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={moveToNextMatch}>
              <ChevronDown className="size-4" />
            </button>
            <span className="text-xs text-base-content/70 min-w-16 text-center">
              {matchedMessageIds.length
                ? `${activeMatchIndex + 1}/${matchedMessageIds.length}`
                : "0/0"}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
                setSearchMode("all");
              }}
            >
              <X className="size-4" />
            </button>
            {canClearChat && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                onClick={() => setIsClearConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Clear chat
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            id={`message-${message._id}`}
            key={message._id}
            className={`group rounded-lg px-1 ${
              activeMatchId === message._id
                ? "bg-primary/10 ring-1 ring-primary/40"
                : matchedMessageSet.has(message._id)
                  ? "bg-base-200/50"
                  : ""
            }`}
            ref={messageEndRef}
          >
            <div className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}>
            <div className=" chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={getAvatarForMessage(message)}
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
              {message.isEdited && !message.isDeleted && (
                <span className="text-xs opacity-60 ml-1">(edited)</span>
              )}
              {message.isDeleted && (
                <span className="text-xs opacity-60 ml-1">(deleted)</span>
              )}
            </div>
            <div className="chat-bubble flex flex-col">
              {message.isDeleted ? (
                <p className="italic opacity-70">This message was deleted</p>
              ) : (
                <>
              {message.image && (
                <img
                  src={message.image}
                  alt="Attachment"
                  className="sm:max-w-[200px] rounded-md mb-2"
                />
              )}
              {editingMessageId === message._id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="input input-sm input-bordered w-full max-w-xs"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => saveEdit(message._id)}
                    disabled={!editedText.trim()}
                    title="Save"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={cancelEditing}
                    title="Cancel"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                message.text && <p>{message.text}</p>
              )}
                </>
              )}
            </div>
            </div>

            {message.senderId === authUser._id && !message.isDeleted && editingMessageId !== message._id && (
              <div
                className={`mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                  message.senderId === authUser._id ? "justify-end" : "justify-start"
                }`}
              >
                {!!message.text && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => startEditing(message)}
                    title="Edit message"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => handleDelete(message._id)}
                  title="Delete message"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <MessageInput />

      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-base-300 bg-base-100 shadow-xl">
            <div className="px-4 py-3 border-b border-base-300">
              <h3 className="font-semibold">Clear Chat</h3>
            </div>
            <div className="px-4 py-4 text-sm text-base-content/80">
              {selectedGroup?._id
                ? `Clear all messages in "${selectedGroup.name}" for everyone? This cannot be undone.`
                : "Clear all messages in this chat? This cannot be undone."}
            </div>
            <div className="px-4 pb-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsClearConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error btn-sm"
                onClick={handleClearChat}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatContainer;
