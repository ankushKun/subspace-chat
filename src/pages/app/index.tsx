import ServerList from "./components/server-list"
import ChannelList from "./components/channel-list"
import MemberList from "./components/member-list"
import MessageList from "./components/message-list"
import useSubspace, { useMessages, useProfile } from "@/hooks/subspace"
import { useEffect, useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import LoginDialog from "@/components/login-dialog"
import DMList from "./components/dm-list"
import type { Profile, Server } from "@/types/subspace"
import UserProfile from "./components/user-profile"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSwipeable } from 'react-swipeable';


export default function App() {
  const [title, setTitle] = useState("Subspace")
  const subspace = useSubspace()
  const { connected, address } = useWallet()
  const { actions: serverActions, activeServerId, activeChannelId, servers } = useServer()
  const { actions: profileActions } = useProfile()
  const { actions: messagesActions } = useMessages()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!connected || !address) {
      serverActions.setActiveChannelId(null)
      serverActions.setActiveServerId(null)
      serverActions.setServersJoined(address, [])
    }
  }, [connected, address])

  useEffect(() => {
    if (!connected || !address) return
    (async () => {
      try {
        serverActions.setActiveChannelId(0)
        serverActions.setActiveServerId(null)
        serverActions.setLoadingServers(true)
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
        serverActions.setLoadingServers(false)
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

        // fetch users primary names
        // call getProfile for each member with a delay of 200ms and update state
        for (const member of members) {
          const profile = await subspace.user.getProfile({ userId: member.userId })
          profileActions.updateProfile(member.userId, profile)
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
    })()
  }, [activeServerId])

  // Interval to fetch latest messages every 2000ms
  useEffect(() => {
    console.log(activeServerId, activeChannelId)

    // Set title based on current context
    if (activeServerId) {
      const server = servers[activeServerId]
      if (server) {
        if (activeChannelId) {
          console.log(server.channels)
          const channel = server.channels.find(channel => channel.channelId == activeChannelId)
          console.log(channel)
          if (channel) {
            setTitle(`#${channel.name} | Subspace`)
          } else {
            setTitle(`${server.name} | Subspace`)
          }
        } else {
          setTitle(`${server.name} | Subspace`)
        }
      } else {
        setTitle("Subspace")
      }
    } else {
      setTitle("Subspace")
    }

    // Only return early if we don't have both activeServerId and activeChannelId for message fetching
    if (!activeChannelId || !activeServerId) {
      return
    }

    // mark channel as read
    subspace.server.channel.markRead({
      serverId: activeServerId,
      channelId: activeChannelId
    })

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

    const interval = setInterval(fetchLatestMessages, 1500)

    return () => clearInterval(interval)
  }, [activeServerId, activeChannelId])

  if (isMobile) return <MobileLayout connected={connected} activeServerId={activeServerId} activeChannelId={activeChannelId} />

  return (
    <div className="flex flex-row items-start justify-start h-svh !overflow-x-clip">
      <title>{title}</title>
      <>
        <ServerList className="w-[80px] min-w-[80px] max-w-[80px] h-svh" />
        {connected && <div className="flex flex-col h-svh">{activeServerId ? (
          <ChannelList className="w-[350px] min-w-[350px] max-w-[350px]" />
        ) : (
          <DMList className="w-[350px] min-w-[350px] max-w-[350px]" />
        )}
          <UserProfile />
        </div>}
      </>
      {connected && address ? (
        <MessageList className="grow h-svh" />
      ) : (
        <LoginPrompt />
      )}
      {connected && activeServerId && <MemberList className="w-[269px] min-w-[269px] max-w-[269px] h-svh" />}
    </div>
  )
}

enum Screens {
  Left = "left",
  Middle = "middle",
  Right = "right"
}

function MobileLayout({ connected, activeServerId, activeChannelId }: { connected: boolean, activeServerId: string | null, activeChannelId: number | null }) {
  const [screen, setScreen] = useState<Screens>(Screens.Left)
  const handlers = useSwipeable({
    // onSwiped: (eventData) => console.log("User Swiped!", eventData),
    // preventScrollOnSwipe: true,
    swipeDuration: 1500,
    trackMouse: true,
    onSwipedLeft: () => {
      if (screen === Screens.Right) return
      if (!connected || !activeServerId || !activeChannelId) return
      setScreen((screen) => screen === Screens.Left ? Screens.Middle : Screens.Right)
    },
    onSwipedRight: () => {
      setScreen((screen) => screen === Screens.Right ? Screens.Middle : Screens.Left)
    }
  });

  useEffect(() => {
    console.log("screen", screen)
  }, [screen])

  useEffect(() => {
    if (!activeChannelId || !activeServerId) setScreen(Screens.Left)
  }, [activeChannelId, activeServerId])

  useEffect(() => {
    if (activeChannelId) setScreen(Screens.Middle)
  }, [activeChannelId])

  return (
    <div className="h-svh flex w-screen p-0 m-0" {...handlers}>
      {screen === Screens.Left && <div className="flex flex-row h-full grow">
        <ServerList className="w-[80px] min-w-[80px] max-w-[80px] h-svh" />
        {connected && <div className="flex flex-col h-svh w-full grow">{activeServerId ? (
          <ChannelList className="grow w-full" />
        ) : (
          <DMList className="grow w-full overflow-clip" />
        )}
          <UserProfile />
        </div>}
      </div>}
      {screen === Screens.Middle && <div className="w-screen flex flex-row h-full">
        {connected && activeServerId && !!activeChannelId && <MessageList className="grow h-svh" />}
      </div>}
      {screen === Screens.Right && <div className="w-screen grow overflow-clip">
        {connected && activeServerId && <MemberList className="grow w-full h-svh overflow-clip" />}
      </div>}

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
            Connect to See Your Servers
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