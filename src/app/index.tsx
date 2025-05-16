import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalState, useServerSync, useCachePersistence, useBackgroundPreload } from '@/hooks/global-state';
import ChannelList from '@/app/components/channel-list';
import DmList from '@/app/components/dm-list';
import Hero from '@/app/components/hero';
import Chat from '@/app/components/chat';
import ServerList from '@/app/components/server-list';
import { useEffect, useRef } from 'react';
import { getNotifications } from '@/lib/ao';
import Profile from './components/profile';
import { useActiveAddress, useConnection } from 'arwalletkit-react';
import { useMobile } from '@/hooks';
import UsersList from './components/users-list';
import UserDM from './user';
import { sendNotification } from '@/lib/utils';

// Create global rate limiting middleware for the app
// This ensures we don't spam servers with requests
const initializeRequestLimiting = () => {
    console.log('[App] Initializing global request limiting');

    // Keep track of any pending member request retry timers
    const pendingRetryTimers = new Set<number>();

    // Clear timers on refresh/navigation 
    window.addEventListener('beforeunload', () => {
        for (const timerId of pendingRetryTimers) {
            clearTimeout(timerId);
        }
        pendingRetryTimers.clear();
    });

    // Add global guards to prevent rapid re-mounting from causing request storms
    console.log('[App] Global request limiting initialized');
};

export default function App() {
    const { connected } = useConnection();
    const isMobile = useMobile();
    const navigate = useNavigate();
    const { serverId, channelId, userId } = useParams();
    const {
        setActiveServerId,
        activeServerId,
        isLoadingServer,
        setActiveChannelId,
        showUsers
    } = useGlobalState();
    const address = useActiveAddress();
    const initRef = useRef(false);

    // Initialize global request limiting on first render only
    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true;
            initializeRequestLimiting();
        }
    }, []);

    useEffect(() => {
        if (!connected || !address) return;

        // Store information about notification polling
        let initialLoadComplete = false;

        // Load seen notification IDs from localStorage
        const getSeenNotificationIds = (): Set<string> => {
            try {
                const seenIdsJson = localStorage.getItem('notifications-seen-ids');
                if (seenIdsJson) {
                    return new Set(JSON.parse(seenIdsJson));
                }
            } catch (error) {
                console.warn('[checkNotifications] Error loading seen notification IDs:', error);
            }
            return new Set<string>();
        };

        // Save seen notification IDs to localStorage
        const saveSeenNotificationIds = (seenIds: Set<string>) => {
            try {
                // Convert Set to Array for JSON serialization
                const idsArray = Array.from(seenIds);

                // Only keep the most recent 500 IDs to prevent localStorage from growing too large
                const recentIds = idsArray.slice(-500);

                localStorage.setItem('notifications-seen-ids', JSON.stringify(recentIds));
            } catch (error) {
                console.warn('[checkNotifications] Error saving seen notification IDs:', error);
            }
        };

        // Store the initial seen notification IDs
        let seenNotificationIds = getSeenNotificationIds();

        // Format message content to simplify mentions for notifications
        const formatMessageContent = (content: string): string => {
            if (!content) return "";

            // Replace @[name](address) with @name
            return content.replace(/@\[(.*?)\]\((.*?)\)/g, '@$1');
        };

        // With HEIGHT_DESC ordering, we need a different approach for periodic polling
        // We'll load history once, then do periodic fresh queries and only process new messages
        const checkNotifications = async () => {
            try {
                // Get user notification preference from localStorage
                const notificationsEnabled = localStorage.getItem('notifications-enabled') !== 'false';
                if (!notificationsEnabled) return;

                // Load the set of already seen notification IDs
                seenNotificationIds = getSeenNotificationIds();

                // For initial load, we use the cursor to paginate through history
                // For subsequent checks, we start fresh each time to get newest notifications
                const forceFresh = initialLoadComplete;
                const currentTime = Date.now();

                console.log(`[checkNotifications] Fetching notifications... (initialLoadComplete: ${initialLoadComplete})`);

                // For initial load, use the stored cursor for pagination
                // For periodic checks, always use an empty cursor to get newest first
                const cursor = initialLoadComplete ? "" : (localStorage.getItem('notifications-cursor') || "");
                const notifications = await getNotifications(address, cursor, forceFresh);

                // Skip if no valid data returned
                if (!notifications) {
                    console.warn('[checkNotifications] No notification data returned');
                    return;
                }

                // Only store cursor during initial history loading
                if (!initialLoadComplete && notifications.cursor && notifications.cursor !== cursor) {
                    localStorage.setItem('notifications-cursor', notifications.cursor);
                    console.log(`[checkNotifications] Updated history cursor: ${notifications.cursor}`);
                }

                // Skip processing if no messages
                if (!notifications.messages || notifications.messages.length === 0) {
                    console.log('[checkNotifications] No new notifications');

                    // If this was the initial load, mark it complete even with no messages
                    if (!initialLoadComplete && !notifications.hasNextPage) {
                        console.log('[checkNotifications] Initial history load complete');
                        initialLoadComplete = true;
                        localStorage.setItem('notifications-last-check', currentTime.toString());
                    }

                    return;
                }

                // If this is still the initial load, check if we've reached the end of history
                if (!initialLoadComplete && !notifications.hasNextPage) {
                    console.log('[checkNotifications] Initial history load complete');
                    initialLoadComplete = true;
                }

                // When polling (not initial load), update the last check time
                if (initialLoadComplete) {
                    localStorage.setItem('notifications-last-check', currentTime.toString());
                }

                console.log(`[checkNotifications] Processing ${notifications.messages.length} notifications`);

                // Filter out already seen notifications
                const newMessages = notifications.messages.filter(message => {
                    // Skip messages without proper IDs
                    if (!message.id || !message.SID || !message.CID) {
                        return false;
                    }

                    // Use the transaction ID as the primary deduplication key
                    const notificationId = message.id;

                    // Skip if we've already seen this notification
                    if (seenNotificationIds.has(notificationId)) {
                        return false;
                    }

                    // Mark as seen for future reference
                    seenNotificationIds.add(notificationId);
                    return true;
                });

                // Save the updated set of seen notification IDs
                saveSeenNotificationIds(seenNotificationIds);

                console.log(`[checkNotifications] ${newMessages.length} new notifications after deduplication`);

                // If all messages were duplicates, skip processing, but continue history loading if needed
                if (newMessages.length === 0) {
                    console.log('[checkNotifications] All notifications were duplicates');

                    // If we're still loading history and there are more pages, continue
                    if (!initialLoadComplete && notifications.hasNextPage) {
                        return;
                    }

                    return;
                }

                // Group messages by server for better organization
                interface ServerMessages {
                    serverName: string;
                    messages: any[];
                }

                const messagesByServer: Record<string, ServerMessages> = newMessages.reduce((acc, message) => {
                    // Ensure we have valid message data
                    if (!message || !message.SID) {
                        return acc;
                    }

                    const serverId = message.SID || 'unknown';
                    const serverName = message.server || 'Unknown Server';

                    if (!acc[serverId]) {
                        acc[serverId] = {
                            serverName,
                            messages: []
                        };
                    }

                    acc[serverId].messages.push(message);
                    return acc;
                }, {} as Record<string, ServerMessages>);

                // Only show notifications for truly new messages during active polling
                // (not for historical messages during the initial load)
                if (initialLoadComplete) {
                    // Handle notifications for each server
                    Object.entries(messagesByServer).forEach(([serverId, data]) => {
                        const { serverName, messages } = data;

                        if (messages.length > 3) {
                            // Group notification for multiple messages
                            sendNotification(
                                `${messages.length} new messages`,
                                {
                                    server: serverName,
                                    SID: serverId,
                                    content: `${messages.length} new messages`
                                }
                            );
                        } else {
                            // Individual notifications for a few messages
                            messages.forEach(message => {
                                const authorName = message.author || 'Unknown User';

                                // Format the message content to simplify mentions
                                const formattedContent = formatMessageContent(message.content);

                                // Create a concise notification with just the essential info
                                sendNotification(
                                    `${authorName}`,
                                    {
                                        ...message,
                                        content: formattedContent
                                    }
                                );
                            });
                        }
                    });
                } else {
                    console.log('[checkNotifications] Silently adding historical messages to seen list');
                }
            } catch (error) {
                console.error("Error checking notifications:", error);
            }
        };

        // Request notification permission on mount
        if ("Notification" in window) {
            if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        }

        // Run immediately on mount
        checkNotifications();

        // Set up interval - check every 15 seconds
        const intervalId = setInterval(checkNotifications, 3000);

        // Cleanup interval on unmount
        return () => clearInterval(intervalId);

    }, [connected, address]);

    useEffect(() => {
        console.log(connected)
        const t = setTimeout(() => {
            if (!connected) {
                navigate("/");
            }
        }, 200);
        return () => clearTimeout(t);
    }, [connected]);

    // Use hooks for server synchronization and cache persistence
    useServerSync();
    useCachePersistence();

    // Prefetch server data in the background when app starts
    useBackgroundPreload();

    useEffect(() => {
        console.log('URL params:', serverId, channelId, userId);

        // Set server ID from URL params
        setActiveServerId(serverId ? serverId : null);

        // Set channel ID from URL params if present
        if (channelId) {
            const channelIdNum = parseInt(channelId, 10);
            if (!isNaN(channelIdNum)) {
                setActiveChannelId(channelIdNum);
            }
        } else {
            // Clear active channel if not in URL
            setActiveChannelId(null);
        }
    }, [serverId, channelId, userId, setActiveServerId, setActiveChannelId]);

    if (isMobile) {
        return <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            {!channelId ? <>
                <div className='w-16 bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                    <ServerList />
                </div>
                {/* channels / dm list */}
                <div className='w-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                    {activeServerId === null ? <DmList /> : <ChannelList />}
                    <Profile />
                </div>
            </> : <>
                <div className='w-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                    {showUsers ? userId ? <UserDM /> : <UsersList /> : <Chat />}
                </div>
            </>}
        </div>;
    }

    return (
        <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            <div className='w-16 bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <ServerList />
            </div>
            {/* channels / dm list */}
            <div className='w-[333px] max-w-[333px] min-w-[333px] bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                {activeServerId === null ? <DmList /> : <ChannelList />}
                <Profile />
            </div>
            {/* main view */}
            <div className='grow w-fit overflow-scroll bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2'>
                {activeServerId === null ? userId ? <UserDM /> : <Hero /> : <Chat />}
            </div>
            {activeServerId !== null && showUsers && <div className='min-w-[300px] bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <UsersList />
            </div>}
        </div>
    )
}