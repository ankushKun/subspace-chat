import ServerList from "./components/server-list"
import ChannelList from "./components/channel-list"
import MemberList from "./components/member-list"
import MessageList from "./components/message-list"

export default function App() {

  return (
    <div className="flex flex-row items-start justify-start h-svh">
      <ServerList className="w-[80px] min-w-[80px] max-w-[80px] h-svh" />
      <ChannelList className="w-[350px] min-w-[350px] max-w-[350px]" />
      <MessageList className="grow h-svh" />
      <MemberList className="w-[269px] min-w-[269px] max-w-[269px] h-svh" />
    </div>
  )
}
