import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser, selectedGroup } = useChatStore();

  return (
    <div className="min-h-screen bg-base-200">
      <div className="flex items-center justify-center px-2 pt-16 sm:px-4 sm:pt-20">
        <div className="bg-base-100 w-full max-w-6xl h-[calc(100vh-4.5rem)] sm:h-[calc(100vh-8rem)] rounded-none sm:rounded-2xl shadow-xl border border-base-300/60 overflow-hidden">
          <div className="flex h-full rounded-none sm:rounded-2xl overflow-hidden">
            <Sidebar />

            {!selectedUser && !selectedGroup ? <NoChatSelected /> : <ChatContainer />}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
