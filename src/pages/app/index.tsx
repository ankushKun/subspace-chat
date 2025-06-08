import ServerList from "./components/server-list"
import ChannelList from "./components/channel-list"
import MemberList from "./components/member-list"
import MessageList from "./components/message-list"
import useSubspace, { useMessages, useProfile, useNotifications } from "@/hooks/subspace"
import { useEffect, useMemo, useState, useCallback } from "react"
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import LoginDialog from "@/components/login-dialog"
import DMList from "./components/dm-list"
import type { Profile, Server } from "@/types/subspace"
import UserProfile from "./components/user-profile"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSwipeable } from 'react-swipeable';
import WelcomePopup from "@/components/welcome-popup"
import { useLocation, useNavigate } from "react-router"
import { useWelcomePopup, type WelcomePopupData } from "@/hooks/use-welcome-popup"
import { toast } from "sonner"


export default function App() {
  const [title, setTitle] = useState("Subspace")
  const { showWelcomePopup, welcomeData, showWelcome, hideWelcome } = useWelcomePopup()
  const [showMemberList, setShowMemberList] = useState(true)

  const subspace = useSubspace()
  // Use more specific selectors to prevent unnecessary re-renders
  const connected = useWallet((state) => state.connected)
  const address = useWallet((state) => state.address)
  const connectionStrategy = useWallet((state) => state.connectionStrategy)
  const walletActions = useWallet((state) => state.actions)

  const activeServerId = useServer((state) => state.activeServerId)
  const activeChannelId = useServer((state) => state.activeChannelId)
  const servers = useServer((state) => state.servers)
  const serversJoined = useServer((state) => state.serversJoined)
  const serverActions = useServer((state) => state.actions)

  const profileActions = useProfile((state) => state.actions)
  const messagesActions = useMessages((state) => state.actions)
  const notificationActions = useNotifications((state) => state.actions)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()

  // Memoize the resize handler to prevent re-creation on every render
  const handleResize = useCallback(() => {
    const windowWidth = window.innerWidth
    // Auto-hide member list when window is smaller than 1200px
    // Auto-show when window is larger than 1280px (with some hysteresis to prevent flickering)
    if (windowWidth < 1200) {
      setShowMemberList(false)
    } else if (windowWidth > 1280) {
      setShowMemberList(true)
    }
  }, [])

  // Auto-collapse member list based on window width
  useEffect(() => {
    // Set initial state based on current window size
    handleResize()

    // Add event listener
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  // Check for welcome popup parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const welcome = urlParams.get('welcome')
    const serverId = urlParams.get('serverId')
    const serverName = urlParams.get('serverName')
    const memberCount = urlParams.get('memberCount')

    if (welcome === 'true' && serverId && serverName && connected) {
      showWelcome({
        serverName: decodeURIComponent(serverName),
        serverId,
        memberCount: parseInt(memberCount || '0', 10)
      })

      // Clean up URL parameters
      navigate('/app', { replace: true })
    }
  }, [location.search, connected, navigate, showWelcome])

  useEffect(() => {
    console.log("connectionStrategy", connectionStrategy, connected, address)
    if (!connected || !address) return
    (async () => {
      if ((connectionStrategy === ConnectionStrategies.ScannedJWK) && address) {
        const delegationDetails = await subspace.user.getDelegationDetails({ userId: address })
        console.log(delegationDetails)
        // If the scanned address has a delegation and we should be using the delegated address
        if (delegationDetails && delegationDetails.isDelegatee && delegationDetails.originalId) {
          // This means the scanned address is the delegatedId and we should use the originalId
          walletActions.updateAddress(delegationDetails.originalId)
        }
        if (!delegationDetails?.delegatedId) {
          walletActions.disconnect()
          toast.error("Account disconnected, please scan the QR code again")
        }
      }
    })()
  }, [connected, connectionStrategy, address])

  useEffect(() => {
    if (!connected || !address) {
      serverActions.setActiveChannelId(0)
      serverActions.setActiveServerId(null)
      serverActions.setServersJoined(address, [])
    }
  }, [connected, address])

  useEffect(() => {
    if (!connected || !address) return
    (async () => {
      try {
        // Only reset server/channel if we're not already connected to maintain last channel state
        if (!activeServerId) {
          serverActions.setActiveChannelId(0)
          serverActions.setActiveServerId("")
        }
        serverActions.setLoadingServers(true)
        const profile = await subspace.user.getProfile({ userId: address })

        // Handle case where profile doesn't exist or serversJoined is not properly formatted
        let userServers: string[] = []

        if (profile) {
          if (profile.serversJoined) {
            if (Array.isArray(profile.serversJoined)) {
              // Already an array
              userServers = profile.serversJoined
            } else if (typeof profile.serversJoined === 'string') {
              try {
                // Try to parse as JSON string
                const parsed = JSON.parse(profile.serversJoined)
                if (Array.isArray(parsed)) {
                  userServers = parsed
                } else {
                  console.warn('serversJoined is not an array after parsing, defaulting to empty array')
                  userServers = []
                }
              } catch (parseError) {
                console.error('Failed to parse serversJoined as JSON:', parseError)
                userServers = []
              }
            } else {
              console.warn('serversJoined is not a string or array, defaulting to empty array')
              userServers = []
            }
          } else {
            userServers = []
          }

          // Ensure profile.serversJoined is always an array for consistency
          profile.serversJoined = userServers
        } else {
          console.log('No profile found for user, defaulting to empty servers list')
          userServers = []
        }

        console.log(`servers found for user: ${userServers.length}`)
        serverActions.setServersJoined(address, userServers)

        // Update notification counts with joined servers
        notificationActions.updateUnreadCounts(userServers)

        for (const serverId of userServers) {
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
        serverActions.setLoadingServers(false)
        // Set empty servers list on error to prevent further issues
        serverActions.setServersJoined(address, [])
      }
    })()
  }, [connected, address])

  // Update notification counts when joined servers change
  useEffect(() => {
    if (address && serversJoined[address]) {
      const userServers = Array.isArray(serversJoined[address]) ? serversJoined[address] : []
      notificationActions.updateUnreadCounts(userServers)
    }
  }, [address, serversJoined])

  useEffect(() => {
    if (address) {
      serverActions.setActiveServerId(null)
      serverActions.setActiveChannelId(null)
    }
  }, [address])

  useEffect(() => {
    (async () => {
      if (activeServerId) {
        try {
          // fetch members
          const members = await subspace.server.getServerMembers({ serverId: activeServerId })

          // Ensure members is an array before proceeding
          if (!Array.isArray(members)) {
            console.warn('Server members response is not an array:', members)
            return
          }

          serverActions.updateServerMembers(activeServerId, members)

          // Only proceed if we have members
          if (members.length > 0) {
            const profiles = await subspace.user.getBulkProfiles({ userIds: members.map(member => member.userId) })
            profileActions.setProfiles(profiles.reduce((acc, profile) => {
              acc[profile.userId] = profile
              return acc
            }, {} as Record<string, Profile>))

            // fetch users primary names
            // call getProfile for each member with a delay of 200ms and update state
            for (const member of members) {
              try {
                const profile = await subspace.user.getProfile({ userId: member.userId })
                profileActions.updateProfile(member.userId, profile)
                await new Promise(resolve => setTimeout(resolve, 200))
              } catch (profileError) {
                console.error(`Error fetching profile for user ${member.userId}:`, profileError)
                // Continue with next member even if one fails
              }
            }
          }
        } catch (error) {
          console.error('Error fetching server members:', error)
        }
      }
    })()
  }, [activeServerId])

  // Interval to fetch latest messages every 2000ms
  useEffect(() => {
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
        messagesActions.setLoadingMessages(true)
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
      } finally {
        messagesActions.setLoadingMessages(false)
      }
    }

    const interval = setInterval(fetchLatestMessages, 1500)

    return () => clearInterval(interval)
  }, [activeServerId, activeChannelId])

  // Listen for browser notification navigation events
  useEffect(() => {
    const handleNotificationNavigate = async (event: CustomEvent) => {
      const { serverId, channelId } = event.detail;

      if (serverId && channelId) {
        try {
          // Navigate to the server and channel directly (don't restore previous channel)
          serverActions.setActiveServerId(serverId);
          serverActions.setActiveChannelId(channelId);

          // Mark notifications for this channel as read on the server
          await subspace.server.channel.markRead({
            serverId: serverId,
            channelId: channelId
          });

          // Update local notification state
          notificationActions.markNotificationsAsRead(serverId, channelId);

          console.log(`Navigated to server ${serverId}, channel ${channelId} from browser notification`);
        } catch (error) {
          console.error("Error handling notification navigation:", error);
        }
      }
    };

    // Add event listener for custom notification navigation events
    window.addEventListener('subspace-notification-navigate', handleNotificationNavigate as EventListener);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('subspace-notification-navigate', handleNotificationNavigate as EventListener);
    };
  }, [subspace, serverActions, notificationActions]);

  if (isMobile) return (
    <>
      <MobileLayout connected={connected} activeServerId={activeServerId} activeChannelId={activeChannelId} onServerJoined={showWelcome} />
      {/* Welcome Popup for Mobile */}
      {welcomeData && (
        <WelcomePopup
          isOpen={showWelcomePopup}
          onClose={hideWelcome}
          data={welcomeData}
        />
      )}
    </>
  )

  return (
    <div className="flex flex-row items-start justify-start h-screen overflow-x-hidden">
      <title>{title}</title>
      <>
        <ServerList className="w-[80px] min-w-[80px] max-w-[80px] h-full flex-shrink-0" onServerJoined={useCallback(showWelcome, [showWelcome])} />
        {connected && <div className="hidden sm:flex flex-col h-full overflow-hidden min-w-fit">{activeServerId ? (
          <ChannelList className="w-[160px] sm:w-[200px] md:w-[240px] lg:w-[280px] xl:w-[320px] 2xl:w-[350px] min-w-[160px] max-w-[350px] overflow-y-auto overflow-x-hidden" />
        ) : (
          <DMList className="w-[160px] sm:w-[200px] md:w-[240px] lg:w-[280px] xl:w-[320px] 2xl:w-[350px] min-w-[160px] max-w-[350px] overflow-y-auto overflow-x-hidden" />
        )}
          <UserProfile />
        </div>}
      </>
      {connected && address ? (
        <MessageList
          className="grow h-full overflow-hidden min-w-0"
          onToggleMemberList={useCallback(() => setShowMemberList(!showMemberList), [showMemberList])}
          showMemberList={showMemberList}
        />
      ) : (
        <LoginPrompt />
      )}
      {connected && activeServerId && showMemberList && <MemberList className="w-[269px] min-w-[269px] max-w-[269px] h-full flex-shrink-0 overflow-y-auto overflow-x-hidden hidden md:flex" />}

      {/* Welcome Popup */}
      {welcomeData && (
        <WelcomePopup
          isOpen={showWelcomePopup}
          onClose={hideWelcome}
          data={welcomeData}
        />
      )}
    </div>
  )
}

export enum Screens {
  Left = "left",
  Middle = "middle",
  Right = "right"
}

function MobileLayout({ connected, activeServerId, activeChannelId, onServerJoined }: {
  connected: boolean,
  activeServerId: string | null,
  activeChannelId: number | null,
  onServerJoined: (data: WelcomePopupData) => void
}) {
  const [screen, setScreen] = useState<Screens>(Screens.Left)
  const handlers = useSwipeable({
    // onSwiped: (eventData) => console.log("User Swiped!", eventData),
    preventScrollOnSwipe: false,
    swipeDuration: 1000,
    trackMouse: true,
    delta: 50,
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

  const viewportHeight = useMemo(() => {
    return window.innerHeight
  }, [])

  return (
    <div className="h-screen flex w-screen p-0 m-0 overflow-clip" {...handlers} style={{ maxHeight: viewportHeight }}>
      {screen === Screens.Left && <div className="flex flex-row h-full grow overflow-hidden">
        <ServerList className="w-[80px] min-w-[80px] max-w-[80px] h-full flex-shrink-0" onServerJoined={onServerJoined} />
        {connected ? <div className="flex flex-col h-full w-full grow overflow-hidden">{activeServerId ? (
          <ChannelList setScreen={setScreen} className="grow w-full overflow-y-auto overflow-x-hidden" />
        ) : (
          <DMList className="grow w-full overflow-y-auto overflow-x-hidden" />
        )}
          <UserProfile />
        </div> : <LoginPrompt />}
      </div>}
      {screen === Screens.Middle && <div className="w-screen flex flex-row">
        {connected && activeServerId && !!activeChannelId && <MessageList className="grow h-full" />}
      </div>}
      {screen === Screens.Right && <div className="w-screen grow overflow-hidden">
        {connected && activeServerId && <MemberList className="grow w-full h-full overflow-y-auto overflow-x-hidden" />}
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
      <div className="flex flex-col items-center justify-center space-y-8 p-8 max-w-md mx-auto text-center relative z-10 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
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