import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalState, useServerSync, useCachePersistence, useBackgroundPreload } from '@/hooks/global-state';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { getNotifications, markNotificationsAsRead } from '@/lib/ao';
import { useActiveAddress, useConnection } from 'arwalletkit-react';
import { useMobile } from '@/hooks';
import { sendNotification } from '@/lib/utils';
import profileManager, { warmupProfileCache } from '@/lib/profile-manager';

// Use lazy loading for components
const ChannelList = lazy(() => import('@/app/components/channel-list'));
const DmList = lazy(() => import('@/app/components/dm-list'));
const Hero = lazy(() => import('@/app/components/hero'));
const Chat = lazy(() => import('@/app/components/chat'));
const ServerList = lazy(() => import('@/app/components/server-list'));
const Profile = lazy(() => import('./components/profile'));
const UsersList = lazy(() => import('./components/users-list'));
const UserDM = lazy(() => import('./user'));
const NotificationsPanel = lazy(() => import('./components/notifications-panel'));

// Loading component
const ComponentLoader = () => (
    <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin h-6 w-6 border-2 border-accent rounded-full border-t-transparent"></div>
    </div>
);

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
        showUsers,
        setShowUsers
    } = useGlobalState();
    const address = useActiveAddress();
    const initRef = useRef(false);
    const lastChannelRef = useRef<{ serverId: string | null, channelId: number | null }>({
        serverId: null,
        channelId: null
    });
    const hasFocusRef = useRef<boolean>(true); // Track if window has focus
    const hasStoredRouteRef = useRef<boolean>(false); // Track if we've stored a route 

    // Initialize global request limiting on first render only
    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true;
            initializeRequestLimiting();
        }

        // Add focus/blur event listeners to track window focus state
        const handleVisibilityChange = () => {
            hasFocusRef.current = document.visibilityState === 'visible';
            console.log(`[App] Window visibility changed: ${document.visibilityState}`);
        };

        const handleBlur = () => {
            hasFocusRef.current = false;
            console.log('[App] Window lost focus');
        };

        const handleFocus = () => {
            hasFocusRef.current = true;
            console.log('[App] Window gained focus');
        };

        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        // Remove event listeners on cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    // Mark notifications as read when entering a channel
    useEffect(() => {
        if (!connected || !address || !serverId || !channelId) return;

        const channelIdNum = parseInt(channelId, 10);
        if (isNaN(channelIdNum)) return;

        // Check if we've changed channel - only mark as read on channel change
        if (lastChannelRef.current.serverId !== serverId ||
            lastChannelRef.current.channelId !== channelIdNum) {

            console.log(`[App] Channel changed to ${serverId}/${channelId}, marking notifications as read`);

            // Debounce the markNotificationsAsRead call
            const timerId = setTimeout(() => {
                markNotificationsAsRead(serverId, channelIdNum)
                    .then(() => {
                        console.log(`[App] Marked notifications as read for ${serverId}/${channelId}`);
                    })
                    .catch(error => {
                        console.warn(`[App] Error marking notifications as read:`, error);
                    });
            }, 300);

            // Update the last channel ref
            lastChannelRef.current = {
                serverId,
                channelId: channelIdNum
            };

            return () => clearTimeout(timerId);
        }
    }, [connected, address, serverId, channelId]);

    // Optimize profile loading: Instead of loading profiles one by one,
    // batch load profiles for visible UI elements
    useEffect(() => {
        if (!connected || !address) return;

        const profileOptimizer = {
            loadedServerMembers: new Set<string>(),

            // Map server IDs to their loaded member IDs
            serverMembersMap: new Map<string, Set<string>>(),

            // Find visible members to prioritize loading their profiles
            collectVisibleMembers: (serverId: string) => {
                try {
                    // Skip if already processed this server
                    if (profileOptimizer.serverMembersMap.has(serverId)) {
                        return;
                    }

                    // Use global state to get server members
                    const globalState = useGlobalState.getState();
                    const members = globalState.getServerMembers(serverId);

                    if (!members || members.length === 0) {
                        return;
                    }

                    // Store members for this server
                    const memberIds = members.map(m => m.id);

                    // Create a set of member IDs for efficient lookup
                    const memberSet = new Set(memberIds);
                    profileOptimizer.serverMembersMap.set(serverId, memberSet);

                    // Warm up the profile cache with these member IDs
                    warmupProfileCache(memberIds);

                    console.log(`[App] Optimized profile loading for ${memberIds.length} members in server ${serverId}`);
                } catch (error) {
                    console.warn(`[App] Error optimizing profiles for server ${serverId}:`, error);
                }
            }
        };

        // When server ID changes, optimize profile loading for visible members
        const optimizeProfileLoading = () => {
            const { activeServerId } = useGlobalState.getState();

            if (activeServerId) {
                profileOptimizer.collectVisibleMembers(activeServerId);
            }
        };

        // Run initial optimization
        optimizeProfileLoading();

        // Set up listener for server changes to optimize profiles when needed
        const unsubscribe = useGlobalState.subscribe(
            (state) => {
                const serverId = state.activeServerId;
                if (serverId) {
                    // Small delay to let other state updates happen first
                    setTimeout(() => profileOptimizer.collectVisibleMembers(serverId), 200);
                }
            }
        );

        return () => {
            unsubscribe();
        };
    }, [connected, address]);

    useEffect(() => {
        if (!connected || !address) return;

        // Store information about notification checking
        let notificationCheckActive = false;
        let consecutiveErrors = 0;
        let pollInterval = 4000; // Start with 4 seconds
        let isMounted = true;
        let lastCheckTime = 0;

        // Store seen notification IDs with improved memory management
        const seenNotificationIds = new Set<string>();

        // Load initially from localStorage
        try {
            const seenIdsJson = localStorage.getItem('notifications-seen-ids');
            if (seenIdsJson) {
                const ids = JSON.parse(seenIdsJson);
                ids.forEach((id: string) => seenNotificationIds.add(id));
                console.log(`[App] Loaded ${seenNotificationIds.size} seen notification IDs from storage`);
            }
        } catch (error) {
            console.warn('[App] Error loading seen notification IDs:', error);
        }

        // Save seen notification IDs to localStorage - with throttling
        const saveSeenIds = (() => {
            let saveTimeout: NodeJS.Timeout | null = null;

            return () => {
                // Clear any existing timeout to debounce saves
                if (saveTimeout) clearTimeout(saveTimeout);

                // Schedule a save in 1 second
                saveTimeout = setTimeout(() => {
                    try {
                        // Convert Set to Array for JSON serialization
                        const idsArray = Array.from(seenNotificationIds);

                        // Only keep the most recent 500 IDs to prevent localStorage from growing too large
                        const recentIds = idsArray.slice(-500);

                        localStorage.setItem('notifications-seen-ids', JSON.stringify(recentIds));
                        console.log(`[App] Saved ${recentIds.length} seen notification IDs to storage`);
                    } catch (error) {
                        console.warn('[App] Error saving seen notification IDs:', error);
                    }
                    saveTimeout = null;
                }, 1000);
            };
        })();

        // Format message content to simplify mentions for notifications
        const formatMessageContent = (content: string): string => {
            if (!content) return "";
            // Replace @[name](address) with @name
            return content.replace(/@\[(.*?)\]\((.*?)\)/g, '@$1');
        };

        // Smart notification checking with improved performance
        const checkNotifications = async () => {
            // Skip if another check is active or we're unmounted
            if (notificationCheckActive || !isMounted) return;

            // Check if we need to throttle requests
            const now = Date.now();
            const timeSinceLastCheck = now - lastCheckTime;
            if (timeSinceLastCheck < pollInterval) {
                console.log(`[App] Skipping notification check, too soon (${timeSinceLastCheck}ms < ${pollInterval}ms)`);
                return;
            }

            lastCheckTime = now;
            notificationCheckActive = true;

            try {
                // Check user preference
                const notificationsEnabled = localStorage.getItem('notifications-enabled') !== 'false';
                if (!notificationsEnabled) {
                    console.log(`[App] Notifications disabled by user preference`);
                    notificationCheckActive = false;
                    return;
                }

                console.log(`[App] Checking notifications...`);

                // This call now uses caching and queueing automatically
                const notifications = await getNotifications(address);

                // Skip if no valid data or no messages
                if (!notifications || !notifications.messages || notifications.messages.length === 0) {
                    console.log('[App] No new notifications');

                    // Reset polling on successful response
                    consecutiveErrors = 0;
                    pollInterval = 4000;

                    notificationCheckActive = false;
                    return;
                }

                // Filter out already seen notifications
                const newMessages = notifications.messages.filter(message => {
                    // Skip messages without proper IDs
                    if (!message.id || !message.SID || !message.CID) {
                        return false;
                    }

                    // Use message ID for deduplication
                    const notificationId = message.id;

                    // Skip if we've already seen this notification
                    if (seenNotificationIds.has(notificationId)) {
                        return false;
                    }

                    // Mark as seen for future reference
                    seenNotificationIds.add(notificationId);
                    return true;
                });

                // Save seen IDs if we added any new ones
                if (newMessages.length > 0) {
                    saveSeenIds();
                }

                // Reset polling interval on successful response
                consecutiveErrors = 0;
                pollInterval = 4000;

                // If no new messages after filtering, we're done
                if (newMessages.length === 0) {
                    console.log('[App] All notifications already seen');
                    notificationCheckActive = false;
                    return;
                }

                // Group messages by server for better organization
                const messagesByServer = newMessages.reduce((acc, message) => {
                    if (!message || !message.SID) return acc;

                    const serverId = message.SID;
                    const serverName = message.server || 'Unknown Server';

                    if (!acc[serverId]) {
                        acc[serverId] = {
                            serverName,
                            messages: []
                        };
                    }

                    acc[serverId].messages.push(message);
                    return acc;
                }, {} as Record<string, { serverName: string; messages: any[] }>);

                // Display notifications
                Object.entries(messagesByServer).forEach(([serverId, data]) => {
                    // Add explicit type checking for the destructured object
                    if (!data) return;

                    const { serverName = 'Unknown Server', messages = [] } = data as {
                        serverName: string;
                        messages: any[]
                    };

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
                            const formattedContent = formatMessageContent(message.content);

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
            } catch (error) {
                console.error("Error checking notifications:", error);

                // Apply exponential backoff
                consecutiveErrors++;
                pollInterval = Math.min(30000, pollInterval * (1 + 0.5 * consecutiveErrors));
                console.warn(`Notification checking error, backing off to ${pollInterval}ms`);
            } finally {
                notificationCheckActive = false;
            }
        };

        // Request notification permission on mount
        if ("Notification" in window) {
            if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        }

        // Initial check after a short delay to avoid startup congestion
        const initialTimerId = setTimeout(checkNotifications, 2000);

        // Set up polling with dynamic interval
        let intervalId = setInterval(checkNotifications, pollInterval);

        // Update interval when pollInterval changes
        const updateIntervalId = setInterval(() => {
            clearInterval(intervalId);
            intervalId = setInterval(checkNotifications, pollInterval);
        }, 30000); // Check every 30 seconds if we need to adjust the interval

        // Cleanup on unmount
        return () => {
            isMounted = false;
            clearTimeout(initialTimerId);
            clearInterval(intervalId);
            clearInterval(updateIntervalId);
        };
    }, [connected, address]);

    useEffect(() => {
        // Prevent unnecessary navigations when app blurs and refocuses
        // Only redirect to landing if truly disconnected and window has focus
        const t = setTimeout(() => {
            // Only redirect if window has focus and connection is lost
            if (!connected && hasFocusRef.current && document.visibilityState === 'visible') {
                // Only store the route once per session to prevent duplication
                if ((serverId || channelId || userId) && !hasStoredRouteRef.current) {
                    sessionStorage.setItem('last_app_route', window.location.hash);
                    hasStoredRouteRef.current = true;
                }
                navigate("/");
            } else if (connected) {
                // Reset the stored route flag when connected
                hasStoredRouteRef.current = false;
            }
        }, 800); // Increased timeout to handle brief connection blips
        return () => clearTimeout(t);
    }, [connected, navigate, serverId, channelId, userId]);

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

        // Collapse users list when server changes
        setShowUsers(false);
    }, [serverId, channelId, userId, setActiveServerId, setActiveChannelId, setShowUsers]);

    if (isMobile) {
        return <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            {!channelId ? <>
                <div className='w-16 bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                    <Suspense fallback={<ComponentLoader />}>
                        <ServerList />
                    </Suspense>
                </div>
                {/* channels / dm list */}
                <div className='w-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                    {activeServerId === null ? <Suspense fallback={<ComponentLoader />}><DmList /></Suspense> : <Suspense fallback={<ComponentLoader />}><ChannelList /></Suspense>}
                    <Suspense fallback={<ComponentLoader />}>
                        <Profile />
                    </Suspense>
                </div>
            </> : <>
                <div className='w-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                    {showUsers ? userId ? <Suspense fallback={<ComponentLoader />}><UserDM /></Suspense> : <Suspense fallback={<ComponentLoader />}><UsersList /></Suspense> : <Suspense fallback={<ComponentLoader />}><Chat /></Suspense>}
                </div>
            </>}
        </div>;
    }

    return (
        <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            <div className='w-16 bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <Suspense fallback={<ComponentLoader />}>
                    <ServerList />
                </Suspense>
            </div>
            {/* channels / dm list */}
            <div className='w-[333px] max-w-[333px] min-w-[333px] bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                {activeServerId === null ? <Suspense fallback={<ComponentLoader />}><DmList /></Suspense> : <Suspense fallback={<ComponentLoader />}><ChannelList /></Suspense>}
                <Suspense fallback={<ComponentLoader />}>
                    <Profile />
                </Suspense>
            </div>
            {/* main view */}
            <div className='grow w-fit overflow-scroll bg-muted/50 rounded-lg flex flex-col items-center justify-start gap-2'>
                {activeServerId === null ? userId ? <Suspense fallback={<ComponentLoader />}><UserDM /></Suspense> : <Suspense fallback={<ComponentLoader />}><Hero /></Suspense> : <Suspense fallback={<ComponentLoader />}><Chat /></Suspense>}
            </div>
            {activeServerId !== null && showUsers && <div className='min-w-[300px] bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2 p-2 py-3'>
                <Suspense fallback={<ComponentLoader />}>
                    <UsersList />
                </Suspense>
            </div>}
        </div>
    )
}