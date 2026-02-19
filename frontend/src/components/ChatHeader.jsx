import { Shield, Trash2, UserMinus, UserX, Users, X } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const {
    selectedUser,
    selectedGroup,
    setSelectedUser,
    setSelectedGroup,
    clearActiveChat,
    leaveGroup,
    deleteGroup,
    removeGroupMember,
  } = useChatStore();
  const { onlineUsers = [], authUser } = useAuthStore();
  const isGroupChat = Boolean(selectedGroup);
  const adminId =
    typeof selectedGroup?.admin === "object"
      ? selectedGroup?.admin?._id
      : selectedGroup?.admin;
  const isGroupAdmin = isGroupChat && adminId === authUser?._id;
  const [confirmAction, setConfirmAction] = useState(null);
  const [isManageOpen, setIsManageOpen] = useState(false);

  const handleLeaveGroup = async () => {
    if (!selectedGroup?._id) return;
    await leaveGroup(selectedGroup._id);
    setConfirmAction(null);
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup?._id) return;
    await deleteGroup(selectedGroup._id);
    setConfirmAction(null);
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedGroup?._id) return;
    await removeGroupMember(selectedGroup._id, memberId);
  };

  const handleClearChat = async () => {
    await clearActiveChat();
    setConfirmAction(null);
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              {isGroupChat ? (
                <div className="size-10 rounded-full bg-base-300 flex items-center justify-center font-semibold">
                  {selectedGroup.name?.slice(0, 2)?.toUpperCase() || "GR"}
                </div>
              ) : (
                <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
              )}
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{isGroupChat ? selectedGroup.name : selectedUser.fullName}</h3>
            {isGroupChat ? (
              <div className="text-sm text-base-content/70">
                <p>{selectedGroup.members?.length || 0} members</p>
                <p className="text-xs opacity-70">
                  Admin: {selectedGroup.admin?.fullName || "Group creator"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-base-content/70">
                {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isGroupChat && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsManageOpen(true)}
              title="Group members"
            >
              <Users className="size-4" />
            </button>
          )}
          {isGroupChat && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmAction("leave")}
              title="Leave group"
            >
              <UserMinus className="size-4" />
            </button>
          )}
          {(!isGroupChat || isGroupAdmin) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              onClick={() => setConfirmAction("clear")}
              title="Clear chat"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          {isGroupAdmin && (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              onClick={() => setConfirmAction("delete")}
              title="Delete group"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          {/* Close button */}
          <button onClick={() => (isGroupChat ? setSelectedGroup(null) : setSelectedUser(null))}>
            <X />
          </button>
        </div>
      </div>

      {isGroupChat && isManageOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-base-300 bg-base-100 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
              <h3 className="font-semibold">Group Members</h3>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setIsManageOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {(selectedGroup.members || []).map((member) => {
                const isAdminMember = member._id === adminId;
                return (
                  <div
                    key={member._id}
                    className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={member.profilePic || "/avatar.png"}
                        alt={member.fullName}
                        className="size-8 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.fullName}</p>
                        <p className="text-xs text-base-content/60 truncate">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdminMember && (
                        <span className="badge badge-outline badge-sm">
                          <Shield className="size-3 mr-1" />
                          Admin
                        </span>
                      )}
                      {isGroupAdmin && !isAdminMember && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => handleRemoveMember(member._id)}
                          title={`Remove ${member.fullName}`}
                        >
                          <UserX className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-base-300 bg-base-100 shadow-xl">
            <div className="px-4 py-3 border-b border-base-300">
              <h3 className="font-semibold">
                {confirmAction === "delete"
                  ? "Delete Group"
                  : confirmAction === "leave"
                    ? "Leave Group"
                    : "Clear Chat"}
              </h3>
            </div>
            <div className="px-4 py-4 text-sm text-base-content/80">
              {confirmAction === "delete"
                ? `Delete "${selectedGroup.name}" for all members? This cannot be undone.`
                : confirmAction === "leave"
                  ? `Leave group "${selectedGroup.name}"?`
                  : isGroupChat
                    ? `Clear all messages in "${selectedGroup.name}" for every member? This cannot be undone.`
                    : `Clear all messages in this chat? This cannot be undone.`}
            </div>
            <div className="px-4 pb-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm ${
                  confirmAction === "delete" || confirmAction === "clear" ? "btn-error" : "btn-primary"
                }`}
                onClick={
                  confirmAction === "delete"
                    ? handleDeleteGroup
                    : confirmAction === "leave"
                      ? handleLeaveGroup
                      : handleClearChat
                }
              >
                {confirmAction === "delete"
                  ? "Delete"
                  : confirmAction === "leave"
                    ? "Leave"
                    : "Clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatHeader;
