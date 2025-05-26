import ServerList from "./components/server-list"
import ChannelList from "./components/channel-list"
import MemberList from "./components/member-list"
import MessageList from "./components/message-list"
import useSubspace, { useMessages, useProfile } from "@/hooks/subspace"
import { useEffect } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import LoginDialog from "@/components/login-dialog"
import DMList from "./components/dm-list"
import type { Profile, Server } from "@/types/subspace"

export default function App() {

  const subspace = useSubspace()
  const { connected, address } = useWallet()
  const { actions: serverActions, activeServerId, activeChannelId, servers } = useServer()
  const { actions: profileActions } = useProfile()
  const { actions: messagesActions } = useMessages()

  useEffect(() => {
    if (!connected || !address) return
    (async () => {
      try {
        serverActions.setActiveChannelId(0)
        serverActions.setActiveServerId(null)
        const profile = await subspace.user.getProfile({ userId: address })
        if (!profile?.serversJoined) {
          profile.serversJoined = []
        } else {
          const servers = JSON.parse(profile.serversJoined as any) as string[]
          profile.serversJoined = servers
        }
        console.log(`servers found for user: ${profile.serversJoined.length}`)
        serverActions.setServersJoined(address, profile.serversJoined)

        for (const serverId of profile.serversJoined) {
          try {
            const details = await subspace.server.getServerDetails({ serverId })
            if (details) {
              // if already exists, update it
              if (servers[serverId]) {
                serverActions.updateServer(serverId, details as Server)
              } else {
                serverActions.addServer({
                  serverId: serverId,
                  ...details,
                })
              }
            } else {
              console.log(`server ${serverId} not found`)
            }
          } catch (error) {
            console.error(`Failed to load server ${serverId}:`, error)
          }
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (error) {
        console.error('Error loading user servers:', error)
      }
    })()
  }, [connected, address])

  useEffect(() => {
    (async () => {
      if (activeServerId) {
        // fetch members
        const members = await subspace.server.getServerMembers({ serverId: activeServerId })
        serverActions.updateServerMembers(activeServerId, members)
        const profiles = await subspace.user.getBulkProfiles({ userIds: members.map(member => member.userId) })
        profileActions.setProfiles(profiles.reduce((acc, profile) => {
          acc[profile.userId] = profile
          return acc
        }, {} as Record<string, Profile>))
      }
    })()
  }, [activeServerId])

  // Interval to fetch latest messages every 2000ms
  useEffect(() => {
    if (!activeChannelId || !activeServerId) return

    const fetchLatestMessages = async () => {
      try {
        const lastMessageId = messagesActions.getLastMessageId(activeServerId, activeChannelId)
        const messages = await subspace.server.message.getMessages({
          serverId: activeServerId,
          channelId: activeChannelId,
          after: lastMessageId
        })
        console.log(messages.length > 0 ? messages : "no new messages")
        if (messages && messages.length > 0) {
          messagesActions.addMessages(activeServerId, activeChannelId, messages)
        }
      } catch (error) {
        console.error('Error fetching latest messages:', error)
      }
    }

    const interval = setInterval(fetchLatestMessages, 2000)

    return () => clearInterval(interval)
  }, [activeServerId, activeChannelId])

  return (
    <div className="flex flex-row items-start justify-start h-svh !overflow-x-clip">
      <ServerList className="w-[80px] min-w-[80px] max-w-[80px] h-svh" />
      {activeServerId ? (
        <ChannelList className="w-[350px] min-w-[350px] max-w-[350px]" />
      ) : (
        <DMList className="w-[350px] min-w-[350px] max-w-[350px]" />
      )}
      {connected && address ? (
        <MessageList className="grow h-svh" />
      ) : (
        <LoginPrompt />
      )}
      {activeServerId && <MemberList className="w-[269px] min-w-[269px] max-w-[269px] h-svh" />}
    </div>
  )
}


function LoginPrompt() {
  return (
    <div className="grow h-svh flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/90 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)] pointer-events-none" />

      {/* Main content */}
      <div className="flex flex-col items-center justify-center space-y-8 p-8 max-w-md mx-auto text-center relative z-10">
        {/* Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center backdrop-blur-sm border border-primary/20 shadow-lg">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          {/* Glow effect */}
          <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
        </div>

        {/* Text content */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Connect to See Your Channels
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Connect your wallet to access your servers and start chatting with your communities.
          </p>
        </div>

        {/* Login button */}
        <div className="pt-4">
          <LoginDialog>
            <div className="px-8 py-3 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 hover:scale-105 cursor-pointer">
              Connect Wallet
            </div>
          </LoginDialog>
        </div>

        {/* Subtle hint */}
        <p className="text-xs text-muted-foreground/70 mt-6">
          Your conversations are waiting for you
        </p>
      </div>
    </div>
  )
}