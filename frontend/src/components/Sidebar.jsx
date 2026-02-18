import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Plus, Users, X } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    getGroups,
    createGroup,
    users,
    groups,
    selectedUser,
    selectedGroup,
    setSelectedUser,
    setSelectedGroup,
    isUsersLoading,
    isGroupsLoading,
    isCreatingGroup,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();

  const { onlineUsers = [], authUser } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const onlineContactsCount = onlineUsers.filter((id) => id !== authUser?._id).length;

  useEffect(() => {
    getUsers();
    getGroups();
    const interval = setInterval(() => {
      getUsers(true);
      getGroups();
    }, 15000);
    return () => clearInterval(interval);
  }, [getUsers, getGroups]);

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [subscribeToMessages, unsubscribeFromMessages]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (selectedMemberIds.length === 0) return;

    const group = await createGroup({ name: groupName.trim(), memberIds: selectedMemberIds });
    if (group) setSelectedGroup(group);
    if (group) {
      setIsCreateGroupOpen(false);
      setGroupName("");
      setSelectedMemberIds([]);
    }
  };

  const toggleMember = (memberId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  if (isUsersLoading || isGroupsLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Contacts</span>
        </div>
        {/* TODO: Online filter toggle */}
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineContactsCount} online)</span>
          <button
            type="button"
            className="btn btn-xs btn-ghost ml-auto"
            onClick={() => setIsCreateGroupOpen(true)}
          >
            <Plus className="size-3.5" />
            Group
          </button>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-12 shrink-0 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0 flex-1">
              <div className="font-medium truncate">{user.fullName}</div>
              <div className="text-sm text-zinc-400 truncate">
                {user.lastMessage || (onlineUsers.includes(user._id) ? "Online" : "Offline")}
              </div>
            </div>
            {!!user.unreadCount && (
              <span className="badge badge-primary badge-sm ml-auto">{user.unreadCount}</span>
            )}
          </button>
        ))}

        {groups.length > 0 && (
          <div className="px-3 pt-4 pb-2 text-xs uppercase tracking-wide text-zinc-500 hidden lg:block">
            Groups
          </div>
        )}

        {groups.map((group) => (
          <button
            key={group._id}
            onClick={() => setSelectedGroup(group)}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedGroup?._id === group._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <div className="size-12 shrink-0 rounded-full bg-base-300 flex items-center justify-center">
                <Users className="size-5" />
              </div>
            </div>
            <div className="hidden lg:block text-left min-w-0 flex-1">
              <div className="font-medium truncate">{group.name}</div>
              <div className="text-sm text-zinc-400 truncate">
                {(group.members || [])
                  .map((member) => member.fullName)
                  .filter(Boolean)
                  .join(", ") || `${group.members?.length || 0} members`}
              </div>
            </div>
          </button>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No online users</div>
        )}
      </div>

      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-base-300 bg-base-100 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
              <h3 className="font-semibold">Create Group</h3>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setIsCreateGroupOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-base-content/80 block mb-2">Group Name</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-base-content/80 block mb-2">
                  Select Members ({selectedMemberIds.length})
                </label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-base-300 p-2 space-y-2">
                  {users.map((user) => (
                    <label
                      key={user._id}
                      className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-base-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedMemberIds.includes(user._id)}
                        onChange={() => toggleMember(user._id)}
                      />
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                        className="size-8 rounded-full object-cover"
                      />
                      <span className="text-sm">{user.fullName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMemberIds.length === 0 || isCreatingGroup}
              >
                {isCreatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
export default Sidebar;
