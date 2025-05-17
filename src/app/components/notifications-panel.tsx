import React, { useEffect, useState } from "react";
import { getNotifications, markNotificationsAsRead } from "@/lib/ao";
import { useNavigate } from "react-router-dom";
import { useGlobalState } from "@/hooks/global-state";
import { useActiveAddress } from "arwalletkit-react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BiSolidInbox } from "react-icons/bi";

export interface Notification {
    id: string;
    recipient: string;
    SID: string;
    CID: string;
    author: string;
    content: string;
    channel: string;
    server: string;
    timestamp: string;
    isRead: boolean;
}

const MAX_STORED_NOTIFICATIONS = 200;

export default function NotificationsPanel() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const {
        setActiveServerId,
        setActiveChannelId,
        setUnreadNotifications,
        serverListCache,
        fetchJoinedServers,
        activeServerId,
        activeChannelId
    } = useGlobalState();
    const address = useActiveAddress();
    const [joinedServers, setJoinedServers] = useState<string[]>([]);

    // Load joined servers list
    useEffect(() => {
        if (!address) return;

        // Initially use cached joined server list if available
        if (serverListCache && serverListCache.address === address) {
            setJoinedServers(serverListCache.data);
        }

        // Then fetch the latest joined servers list
        const loadJoinedServers = async () => {
            try {
                const servers = await fetchJoinedServers(address, false);
                setJoinedServers(servers);
            } catch (error) {
                console.error("Failed to fetch joined servers for notifications:", error);
            }
        };

        loadJoinedServers();
    }, [address, serverListCache, fetchJoinedServers]);

    // Listen for active channel changes to mark notifications as read
    useEffect(() => {
        if (!activeServerId || !activeChannelId || !address) return;

        // Check if we have unread notifications for this channel
        const hasUnreadNotificationsForChannel = notifications.some(
            notification =>
                notification.SID === activeServerId &&
                notification.CID === activeChannelId.toString() &&
                !notification.isRead
        );

        if (hasUnreadNotificationsForChannel) {
            // Update local state to mark notifications for this channel as read
            setNotifications(prevNotifications => {
                const updatedNotifications = prevNotifications.map(n => {
                    if (n.SID === activeServerId && n.CID === activeChannelId.toString() && !n.isRead) {
                        return { ...n, isRead: true };
                    }
                    return n;
                });

                // Save to localStorage
                if (address) {
                    localStorage.setItem(`notifications-${address}`, JSON.stringify(updatedNotifications));
                }

                return updatedNotifications;
            });
        }
    }, [activeServerId, activeChannelId, address, notifications]);

    // Load stored notifications from localStorage
    useEffect(() => {
        if (!address) return;

        try {
            const storedNotifications = localStorage.getItem(`notifications-${address}`);
            if (storedNotifications) {
                setNotifications(JSON.parse(storedNotifications));
            }
        } catch (error) {
            console.error("Failed to load notifications from localStorage:", error);
        }
    }, [address]);

    // Update global state with unread notifications whenever notifications change
    useEffect(() => {
        // Group unread notifications by server and channel, but only for joined servers
        const unreadByServer: Record<string, Set<string>> = {};
        // Track counts of unread notifications per server and channel
        const unreadCountsByServer: Record<string, number> = {};
        const unreadCountsByChannel: Record<string, Record<string, number>> = {};

        notifications.forEach(notification => {
            // Only process notifications from servers the user has joined
            if (!notification.isRead && joinedServers.includes(notification.SID)) {
                // Add to server/channel mapping
                if (!unreadByServer[notification.SID]) {
                    unreadByServer[notification.SID] = new Set();
                    unreadCountsByServer[notification.SID] = 0;
                    unreadCountsByChannel[notification.SID] = {};
                }
                unreadByServer[notification.SID].add(notification.CID);

                // Increment server count
                unreadCountsByServer[notification.SID]++;

                // Increment channel count
                if (!unreadCountsByChannel[notification.SID][notification.CID]) {
                    unreadCountsByChannel[notification.SID][notification.CID] = 0;
                }
                unreadCountsByChannel[notification.SID][notification.CID]++;
            }
        });

        // Update global state with all notification data
        setUnreadNotifications({
            serverChannelMap: unreadByServer,
            serverCounts: unreadCountsByServer,
            channelCounts: unreadCountsByChannel
        });

    }, [notifications, setUnreadNotifications, joinedServers]);

    // Fetch notifications and merge with local storage - improved with better caching
    useEffect(() => {
        if (!address) return;

        let pollInterval = 4000; // Start with 4 seconds
        let consecutiveErrors = 0;
        let isFetching = false;
        let isMounted = true;
        let lastFetchTime = 0;

        // Load stored notifications first for immediate display
        try {
            const storedNotifications = localStorage.getItem(`notifications-${address}`);
            if (storedNotifications) {
                setNotifications(JSON.parse(storedNotifications));
                setLoading(false);
            }
        } catch (error) {
            console.error("Failed to load notifications from localStorage:", error);
        }

        // Fetch notifications with debouncing, caching and error handling
        const fetchNotificationsWithDebounce = async () => {
            // Don't fetch if unmounted or another fetch is in progress
            if (!isMounted || isFetching) return;

            // Check if we need to throttle requests
            const now = Date.now();
            const timeSinceLastFetch = now - lastFetchTime;
            if (timeSinceLastFetch < pollInterval) {
                console.log(`[NotificationsPanel] Skipping fetch, too soon (${timeSinceLastFetch}ms < ${pollInterval}ms)`);
                return;
            }

            isFetching = true;
            lastFetchTime = now;

            try {
                setLoading(true);
                // This call now uses cached data when appropriate
                const result = await getNotifications(address);

                if (!result.messages || !Array.isArray(result.messages)) {
                    if (isMounted) {
                        setLoading(false);
                    }
                    isFetching = false;
                    return;
                }

                // Mark server notifications as unread
                const serverNotifications = result.messages.map((notification: any) => ({
                    ...notification,
                    isRead: false
                }));

                if (isMounted) {
                    setNotifications(prevNotifications => {
                        // Filter out old notifications that match the new ones from server
                        const filteredPrevNotifications = prevNotifications.filter(
                            prev => !serverNotifications.some(
                                (serverNotif: Notification) => serverNotif.id === prev.id
                            )
                        );

                        // Combine with new notifications from server
                        const updatedNotifications = [...filteredPrevNotifications, ...serverNotifications];

                        // Sort by timestamp (newest first)
                        updatedNotifications.sort((a, b) =>
                            parseInt(b.timestamp) - parseInt(a.timestamp)
                        );

                        // Limit to MAX_STORED_NOTIFICATIONS to prevent localStorage from growing too large
                        const limitedNotifications = updatedNotifications.slice(0, MAX_STORED_NOTIFICATIONS);

                        // Save to localStorage
                        if (address) {
                            localStorage.setItem(`notifications-${address}`, JSON.stringify(limitedNotifications));
                        }

                        return limitedNotifications;
                    });
                }

                // Reset error counter and polling interval on success
                consecutiveErrors = 0;
                pollInterval = 4000;
            } catch (error) {
                console.error("Failed to fetch notifications:", error);

                // Implement exponential backoff on errors
                consecutiveErrors++;
                pollInterval = Math.min(30000, pollInterval * (1 + 0.5 * consecutiveErrors));
                console.warn(`Notification polling error, backing off to ${pollInterval}ms`);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
                isFetching = false;
            }
        };

        // Initial fetch - delayed slightly to avoid API congestion on startup
        setTimeout(fetchNotificationsWithDebounce, 1000);

        // Set up polling with dynamic polling interval that adapts to errors
        const updatePollingInterval = () => {
            if (!isMounted) return;

            // Clear any existing interval
            if (intervalId) clearInterval(intervalId);

            // Set new interval based on current poll interval
            intervalId = setInterval(fetchNotificationsWithDebounce, pollInterval);
        };

        // Initial polling setup
        let intervalId = setInterval(fetchNotificationsWithDebounce, pollInterval);

        // Check and update the polling interval periodically
        const adjustmentInterval = setInterval(updatePollingInterval, 30000);

        return () => {
            isMounted = false;
            if (intervalId) clearInterval(intervalId);
            clearInterval(adjustmentInterval);
        };
    }, [address]);

    // Get filtered notifications (only from joined servers)
    const filteredNotifications = notifications.filter(notification =>
        joinedServers.includes(notification.SID)
    );

    // Count unread notifications (only from joined servers)
    const unreadCount = filteredNotifications.filter(n => !n.isRead).length;

    // Handle notification click - navigate and mark as read
    const handleNotificationClick = async (notification: Notification) => {
        try {
            // Navigate to the server and channel
            setActiveServerId(notification.SID);
            setActiveChannelId(parseInt(notification.CID, 10));
            navigate(`/app/${notification.SID}/${notification.CID}`);

            // Only call the API if the notification is not already read
            if (!notification.isRead) {
                // Mark notifications for this channel as read on the server
                await markNotificationsAsRead(notification.SID, parseInt(notification.CID, 10));

                // Update local state to mark notifications for this channel as read
                setNotifications(prevNotifications => {
                    const updatedNotifications = prevNotifications.map(n => {
                        if (n.SID === notification.SID && n.CID === notification.CID && !n.isRead) {
                            return { ...n, isRead: true };
                        }
                        return n;
                    });

                    // Save to localStorage
                    if (address) {
                        localStorage.setItem(`notifications-${address}`, JSON.stringify(updatedNotifications));
                    }

                    return updatedNotifications;
                });
            }
        } catch (error) {
            console.error("Error handling notification click:", error);
        }
    };

    // Format message content to simplify mentions
    const formatContent = (content: string): string => {
        if (!content) return "";

        // Replace @[name](address) with @name
        let formatted = content.replace(/@\[(.*?)\]\((.*?)\)/g, '@$1');

        // Shorten wallet addresses (match typical Arweave/crypto wallet address patterns)
        formatted = formatted.replace(/\b([a-zA-Z0-9]{5})[a-zA-Z0-9]{30,}([a-zA-Z0-9]{5})\b/g, '$1...$2');

        return formatted;
    };

    // Shorten wallet addresses
    const shortenAddress = (address: string): string => {
        if (!address) return "";
        // Check if it looks like a wallet address (long alphanumeric string)
        if (/^[a-zA-Z0-9_-]{30,}$/.test(address)) {
            return `${address.substring(0, 5)}...${address.substring(address.length - 5)}`;
        }
        return address;
    };

    // Format timestamp to match the screenshot format
    const formatTimestamp = (timestamp: string): string => {
        try {
            // Handle millisecond timestamps by converting to seconds if needed
            const timestampInSeconds = timestamp.length > 10
                ? Math.floor(parseInt(timestamp, 10) / 1000)
                : parseInt(timestamp, 10);

            const date = new Date(timestampInSeconds * 1000);
            const now = new Date();
            const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

            if (diffInMinutes < 1) {
                return 'just now';
            } else if (diffInMinutes === 1) {
                return '1 minute ago';
            } else if (diffInMinutes < 60) {
                return `${diffInMinutes} minutes ago`;
            } else if (diffInMinutes < 120) {
                return '1 hour ago';
            } else if (diffInMinutes < 1440) { // Less than 24 hours
                const hours = Math.floor(diffInMinutes / 60);
                return `${hours} hours ago`;
            } else if (diffInMinutes < 2880) { // Less than 48 hours
                return 'yesterday';
            } else {
                return format(date, 'dd MMM yyyy HH:mm');
            }
        } catch (error) {
            console.error("Error formatting timestamp:", error);
            return "recently";
        }
    };

    return (
        <div className="relative">
            <Button variant="ghost" size="icon" className="!p-0" onClick={() => setOpen(!open)}>
                <BiSolidInbox className="!h-5 !w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                        {unreadCount}
                    </span>
                )}
            </Button>

            {/* Notification panel */}
            {open && (
                <div className="absolute right-0 top-full mt-0 w-80 max-w-[calc(100vw-20px)] bg-background/60 backdrop-blur-2xl border border-border rounded-lg shadow-lg z-50 md:right-0 right-0 max-sm:left-auto max-sm:right-0 max-sm:translate-x-0">
                    <div className="flex items-center justify-between p-3 border-b border-border">
                        <h3 className="font-medium">Mentions</h3>
                        <button onClick={() => setOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className="max-h-[min(400px,70vh)] overflow-y-auto p-2">
                        {filteredNotifications.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                                No mentions to display
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {(() => {
                                    // Sort notifications by timestamp (newest first)
                                    const sortedNotifications = [...filteredNotifications].sort(
                                        (a, b) => parseInt(b.timestamp) - parseInt(a.timestamp)
                                    );

                                    // Group notifications by server while preserving chronological order
                                    const result: React.ReactNode[] = [];
                                    let currentServer = '';

                                    sortedNotifications.forEach((notification, index) => {
                                        // Add server header when server changes
                                        if (notification.server !== currentServer) {
                                            currentServer = notification.server;
                                            result.push(
                                                <div key={`server-${notification.SID}-${index}`} className="text-sm font-semibold text-foreground px-2 pt-1 mt-2 first:mt-0">
                                                    {notification.server}
                                                </div>
                                            );
                                        }

                                        // Add notification
                                        result.push(
                                            <div
                                                key={notification.id}
                                                className={`p-2 rounded-md ${notification.isRead
                                                    ? 'bg-muted/30 text-muted-foreground'
                                                    : 'bg-muted/60'} cursor-pointer transition-colors hover:bg-muted/80`}
                                                onClick={() => handleNotificationClick(notification)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={`font-medium text-sm ${notification.isRead ? 'text-muted-foreground' : ''}`}>
                                                        {shortenAddress(notification.author)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        {formatTimestamp(notification.timestamp)}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-muted-foreground">#{notification.channel}</div>
                                                <div className={`text-sm mt-1 break-words ${notification.isRead ? 'text-muted-foreground' : ''}`}>
                                                    {formatContent(notification.content)}
                                                </div>
                                            </div>
                                        );
                                    });

                                    return result;
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
} 