import { useChatStore } from "../store/useChatStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    loadOlderMessages,
    markMessagesAsSeen,
    isMessagesLoading,
    isFetchingOlderMessages,
    isSearchingMessages,
    messagePagination,
    selectedUser,
    selectedGroup,
    editMessage,
    deleteMessage,
    clearActiveChat,
    searchMessages,
    searchResults,
    clearSearchResults,
    retryPendingMessages,
  } = useChatStore();
  const { authUser, socketRecoveryKey, socketStatus } = useAuthStore();
  const messageEndRef = useRef(null);
  const messageListRef = useRef(null);
  const shouldAutoScrollRef = useRef(false);
  const lastRecoveredKeyRef = useRef(0);
  const searchDebounceRef = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("all");
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (selectedGroup?._id) {
      shouldAutoScrollRef.current = true;
      void retryPendingMessages();
      getGroupMessages(selectedGroup._id);
      return;
    }

    if (selectedUser?._id) {
      shouldAutoScrollRef.current = true;
      void retryPendingMessages();
      getMessages(selectedUser._id);
      markMessagesAsSeen(selectedUser._id);
    }
  }, [
    selectedUser?._id,
    selectedGroup?._id,
    retryPendingMessages,
    getMessages,
    getGroupMessages,
    loadOlderMessages,
    markMessagesAsSeen,
  ]);

  useEffect(() => {
    if (!socketRecoveryKey || socketRecoveryKey === lastRecoveredKeyRef.current) return;
    if (socketStatus !== "online") return;

    lastRecoveredKeyRef.current = socketRecoveryKey;

    if (selectedGroup?._id) {
      void retryPendingMessages();
      getGroupMessages(selectedGroup._id);
      return;
    }

    if (selectedUser?._id) {
      void retryPendingMessages();
      getMessages(selectedUser._id);
      markMessagesAsSeen(selectedUser._id);
    }
  }, [
    socketRecoveryKey,
    socketStatus,
    selectedUser?._id,
    selectedGroup?._id,
    retryPendingMessages,
    getMessages,
    getGroupMessages,
    markMessagesAsSeen,
  ]);

  useEffect(() => {
    if (shouldAutoScrollRef.current && messageEndRef.current && messages.length) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
      shouldAutoScrollRef.current = false;
    }
  }, [messages]);

  const handleLoadOlderMessages = async () => {
    const listEl = messageListRef.current;
    if (!listEl || isFetchingOlderMessages || !messagePagination?.hasMore) return;

    const previousScrollHeight = listEl.scrollHeight;
    const loaded = await loadOlderMessages();
    if (!loaded) return;

    requestAnimationFrame(() => {
      const nextScrollHeight = listEl.scrollHeight;
      listEl.scrollTop = nextScrollHeight - previousScrollHeight + listEl.scrollTop;
    });
  };

  const handleMessageListScroll = async (event) => {
    const target = event.currentTarget;
    if (target.scrollTop > 120) return;
    await handleLoadOlderMessages();
  };

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!isSearchOpen) {
      clearSearchResults();
      return;
    }

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      clearSearchResults();
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      searchMessages({ query: trimmedQuery, mode: searchMode }).then((results) => {
        setActiveMatchIndex(results.length ? 0 : -1);
      });
    }, 250);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, searchMode, isSearchOpen, searchMessages, clearSearchResults]);

  const matchedMessageIds = useMemo(
    () => searchResults.map((message) => message._id),
    [searchResults]
  );

  const effectiveActiveMatchIndex =
    activeMatchIndex >= 0 && activeMatchIndex < matchedMessageIds.length
      ? activeMatchIndex
      : matchedMessageIds.length
        ? 0
        : -1;
  const activeMatchId =
    effectiveActiveMatchIndex >= 0 ? matchedMessageIds[effectiveActiveMatchIndex] : null;
  const matchedMessageSet = useMemo(() => new Set(matchedMessageIds), [matchedMessageIds]);

  const ensureMessageIsLoaded = useCallback(async (messageId) => {
    let messageEl = document.getElementById(`message-${messageId}`);
    let attempts = 0;

    while (!messageEl && useChatStore.getState().messagePagination?.hasMore && attempts < 10) {
      const loaded = await loadOlderMessages();
      if (!loaded) break;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      messageEl = document.getElementById(`message-${messageId}`);
      attempts += 1;
    }

    return messageEl;
  }, [loadOlderMessages]);

  const focusSearchResult = useCallback(async (messageId) => {
    const messageEl = await ensureMessageIsLoaded(messageId);
    messageEl?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ensureMessageIsLoaded]);

  useEffect(() => {
    if (!activeMatchId) return;
    void focusSearchResult(activeMatchId);
  }, [activeMatchId, focusSearchResult]);

  const moveToNextMatch = () => {
    if (!matchedMessageIds.length) return;
    setActiveMatchIndex((effectiveActiveMatchIndex + 1) % matchedMessageIds.length);
  };

  const moveToPrevMatch = () => {
    if (!matchedMessageIds.length) return;
    setActiveMatchIndex(
      effectiveActiveMatchIndex <= 0 ? matchedMessageIds.length - 1 : effectiveActiveMatchIndex - 1
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

  const isOwnMessage = (message) => String(message?.senderId) === String(authUser?._id);

  const getAvatarForMessage = (message) => {
    if (isOwnMessage(message)) return authUser.profilePic || "/avatar.png";
    if (selectedGroup?.members?.length) {
      const sender = selectedGroup.members.find((member) => String(member._id) === String(message.senderId));
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

  const getDeliveryStatusLabel = (message) => {
    if (message.deliveryStatus === "sending") {
      return message._retryCount ? `Retrying (${message._retryCount})...` : "Sending...";
    }

    if (message.deliveryStatus === "queued") {
      return message._retryCount ? `Queued for retry (${message._retryCount})` : "Queued for retry";
    }

    if (message.deliveryStatus === "failed") {
      return "Send failed";
    }

    return "";
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
                ? `${effectiveActiveMatchIndex + 1}/${matchedMessageIds.length}`
                : "0/0"}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
                setSearchMode("all");
                clearSearchResults();
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
        {isSearchOpen && (
          <div className="mt-2 rounded-xl border border-base-300 bg-base-200/40">
            {isSearchingMessages ? (
              <div className="px-3 py-3 text-sm text-base-content/70">Searching conversation...</div>
            ) : searchQuery.trim().length < 2 ? (
              <div className="px-3 py-3 text-sm text-base-content/70">
                Type at least 2 characters to search the full conversation
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-3 text-sm text-base-content/70">No matches found</div>
            ) : (
              <div className="max-h-44 overflow-y-auto py-2">
                {searchResults.map((result, index) => (
                  <button
                    key={result._id}
                    type="button"
                    className={`w-full px-3 py-2 text-left transition-colors hover:bg-base-300/60 ${
                      activeMatchId === result._id ? "bg-base-300/60" : ""
                    }`}
                    onClick={async () => {
                      setActiveMatchIndex(index);
                      await focusSearchResult(result._id);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        {result.isDeleted
                          ? "Deleted message"
                          : result.text?.trim() || (result.image ? "Image attachment" : "Message")}
                      </p>
                      <span className="shrink-0 text-xs text-base-content/60">
                        {formatMessageTime(result.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        ref={messageListRef}
        data-testid="message-list"
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleMessageListScroll}
      >
        {isFetchingOlderMessages && (
          <div className="flex justify-center pb-2">
            <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs text-base-content/70">
              Loading older messages...
            </span>
          </div>
        )}
        {!messagePagination?.hasMore && messages.length > 0 && (
          <div className="flex justify-center pb-2">
            <span className="text-xs text-base-content/50">Start of conversation</span>
          </div>
        )}
        {messages.map((message) => (
          <div
            id={`message-${message._id}`}
            key={message.clientMessageId || message._id}
            data-testid="chat-message"
            data-message-id={message.clientMessageId || message._id}
            className={`group rounded-lg px-1 ${
              activeMatchId === message._id
                ? "bg-primary/10 ring-1 ring-primary/40"
                : matchedMessageSet.has(message._id)
                  ? "bg-base-200/50"
                  : ""
            }`}
          >
            <div className={`chat ${isOwnMessage(message) ? "chat-end" : "chat-start"}`}>
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
              {isOwnMessage(message) && message.deliveryStatus !== "sent" && (
                <span className="text-xs opacity-60 ml-1">{getDeliveryStatusLabel(message)}</span>
              )}
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

            {isOwnMessage(message) &&
              !message.isDeleted &&
              editingMessageId !== message._id &&
              !message._isOptimistic &&
              message.deliveryStatus === "sent" && (
              <div
                className={`mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                  isOwnMessage(message) ? "justify-end" : "justify-start"
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
        <div ref={messageEndRef} />
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
