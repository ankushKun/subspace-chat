import { InboxIcon, X, Trash2, CheckCheck, Volume2, VolumeX, Bell, BellOff } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn, shortenAddress } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/hooks/use-wallet";
import useSubspace, { useNotifications, useServer } from "@/hooks/subspace";
import { useSound } from "@/hooks/use-sound";
import { format } from "date-fns";
import type { SubspaceNotification } from "@/types/subspace";

export default function InboxComponent({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const [open, setOpen] = useState(false);
    const { address } = useWallet();
    const subspace = useSubspace();
    const {
        notifications,
        loading,
        unreadCount,
        actions: notificationActions
    } = useNotifications();
    const {
        activeServerId,
        activeChannelId,
        serversJoined,
        actions: serverActions
    } = useServer();
    const {
        playNotification,
        showBrowserNotification,
        isLoaded: soundLoaded,
        isEnabled: soundEnabled,
        setEnabled: setSoundEnabled,
        browserNotificationsEnabled,
        setBrowserNotificationsEnabled,
        requestNotificationPermission,
        notificationPermission
    } = useSound();

    // Set current user ID when address changes
    useEffect(() => {
        notificationActions.setCurrentUserId(address);
    }, [address]);

    // Set up notification sound callback
    useEffect(() => {
        notificationActions.setOnNewNotification(playNotification);

        // Cleanup callback on unmount
        return () => {
            notificationActions.setOnNewNotification(null);
        };
    }, [playNotification]);

    // Set up browser notification callback
    useEffect(() => {
        notificationActions.setOnShowBrowserNotification(showBrowserNotification);

        // Cleanup callback on unmount
        return () => {
            notificationActions.setOnShowBrowserNotification(null);
        };
    }, [showBrowserNotification]);

    // Request notification permission when browser notifications are enabled
    useEffect(() => {
        if (browserNotificationsEnabled && notificationPermission === 'default') {
            requestNotificationPermission();
        }
    }, [browserNotificationsEnabled, notificationPermission, requestNotificationPermission]);

    // Get notifications for current user only
    const currentUserNotifications = notificationActions.getCurrentUserNotifications();

    // Get joined servers for current user
    const joinedServers = address ? (Array.isArray(serversJoined[address]) ? serversJoined[address] : []) : [];

    // Filter notifications to only show those from joined servers
    const filteredNotifications = currentUserNotifications.filter(notification =>
        joinedServers.includes(notification.serverId)
    );

    // Count unread notifications from joined servers only
    const unreadCountFiltered = filteredNotifications.filter(n => n.read === 0).length;

    // Fetch notifications on mount and periodically
    useEffect(() => {
        if (!address) return;

        let pollInterval = 4000; // Start with 4 seconds
        let consecutiveErrors = 0;
        let isFetching = false;
        let isMounted = true;
        let lastFetchTime = 0;

        const fetchNotifications = async () => {
            if (!isMounted || isFetching) return;

            const now = Date.now();
            const timeSinceLastFetch = now - lastFetchTime;
            if (timeSinceLastFetch < pollInterval) {
                return;
            }

            isFetching = true;
            lastFetchTime = now;

            try {
                notificationActions.setLoading(true);
                const result = await subspace.user.getNotifications({ userId: address });

                if (result && Array.isArray(result)) {
                    // Mark new notifications as unread (read: 0)
                    const newNotifications = result.map(notification => ({
                        ...notification,
                        read: 0 // New notifications from server are unread
                    }));

                    notificationActions.addNotifications(newNotifications);
                    notificationActions.updateUnreadCounts(joinedServers);
                }

                // Reset error counter and polling interval on success
                consecutiveErrors = 0;
                pollInterval = 4000;
            } catch (error) {
                console.error("Failed to fetch notifications:", error);

                // Implement exponential backoff on errors
                consecutiveErrors++;
                pollInterval = Math.min(30000, pollInterval * (1 + 0.5 * consecutiveErrors));
            } finally {
                if (isMounted) {
                    notificationActions.setLoading(false);
                }
                isFetching = false;
            }
        };

        // Initial fetch
        setTimeout(fetchNotifications, 1000);

        // Set up polling
        const intervalId = setInterval(fetchNotifications, pollInterval);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [address, joinedServers.join(',')]);

    // Update unread counts when joined servers change
    useEffect(() => {
        notificationActions.updateUnreadCounts(joinedServers);
    }, [joinedServers.join(',')]);

    // Mark notifications as read when user navigates to a channel
    useEffect(() => {
        if (!activeServerId || !activeChannelId || !address) return;

        // Check if we have unread notifications for this channel
        const hasUnreadNotificationsForChannel = currentUserNotifications.some(
            notification =>
                notification.serverId === activeServerId &&
                notification.channelId === activeChannelId &&
                notification.read === 0
        );

        if (hasUnreadNotificationsForChannel) {
            // Mark notifications for this channel as read locally
            notificationActions.markNotificationsAsRead(activeServerId, activeChannelId);
        }
    }, [activeServerId, activeChannelId, address, currentUserNotifications]);

    // Handle notification click - navigate and mark as read
    const handleNotificationClick = async (notification: SubspaceNotification) => {
        try {
            // Navigate to the server and channel
            serverActions.setActiveServerId(notification.serverId);
            serverActions.setActiveChannelId(notification.channelId);

            // Mark notifications for this channel as read on the server
            if (notification.read === 0) {
                await subspace.server.channel.markRead({
                    serverId: notification.serverId,
                    channelId: notification.channelId
                });

                // Update local state
                notificationActions.markNotificationsAsRead(notification.serverId, notification.channelId);
            }

            // Close the popover
            setOpen(false);
        } catch (error) {
            console.error("Error handling notification click:", error);
        }
    };

    // Handle clear all notifications
    const handleClearAll = () => {
        subspace.server.channel.markRead({})
        notificationActions.clearNotifications();
    };

    // Format message content to simplify mentions
    const formatContent = (content: string): string => {
        if (!content) return "";

        // Replace @[name](address) with @name
        let formatted = content.replace(/@\[(.*?)\]\((.*?)\)/g, '@$1');

        // Shorten wallet addresses
        formatted = formatted.replace(/\b([a-zA-Z0-9]{5})[a-zA-Z0-9]{30,}([a-zA-Z0-9]{5})\b/g, '$1...$2');

        return formatted;
    };

    // Format timestamp
    const formatTimestamp = (timestamp: number): string => {
        try {
            // Handle both seconds and milliseconds timestamps
            // If timestamp is less than a reasonable threshold, assume it's in seconds
            const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
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
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className={cn("relative", props.className)}>
                {children ? children : (
                    <>
                        <Button variant="ghost" size="icon" className="relative">
                            <InboxIcon className="!w-5 !h-5" />
                            {unreadCountFiltered > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center !text-xs font-medium">
                                    {unreadCountFiltered > 99 ? '99+' : unreadCountFiltered}
                                </span>
                            )}
                        </Button>
                    </>
                )}
            </PopoverTrigger>
            <PopoverContent
                className="w-80 max-w-[calc(100vw-20px)] bg-background/60 backdrop-blur-2xl border border-border shadow-lg p-0"
                side="bottom"
                align="end"
            >
                <div className="flex items-center justify-between p-3 border-b border-border">
                    <h3 className="font-medium">Mentions</h3>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            title={soundEnabled ? "Disable notification sounds" : "Enable notification sounds"}
                            className="text-xs rounded-full p-0"
                        >
                            {soundEnabled ? (
                                <Volume2 className="!w-4 !h-4" />
                            ) : (
                                <VolumeX className="!w-4 !h-4" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                                if (!browserNotificationsEnabled) {
                                    // Request permission when enabling
                                    const granted = await requestNotificationPermission();
                                    if (granted) {
                                        setBrowserNotificationsEnabled(true);
                                    }
                                } else {
                                    setBrowserNotificationsEnabled(false);
                                }
                            }}
                            title={
                                notificationPermission === 'denied'
                                    ? "Browser notifications blocked - check browser settings"
                                    : browserNotificationsEnabled
                                        ? "Disable browser notifications"
                                        : "Enable browser notifications"
                            }
                            className={cn(
                                "text-xs rounded-full p-0",
                                notificationPermission === 'denied' && "opacity-50 cursor-not-allowed"
                            )}
                            disabled={notificationPermission === 'denied'}
                        >
                            {browserNotificationsEnabled && notificationPermission === 'granted' ? (
                                <Bell className="!w-4 !h-4" />
                            ) : (
                                <BellOff className="!w-4 !h-4" />
                            )}
                        </Button>
                        {filteredNotifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleClearAll}
                                title="Mark all as mentions read"
                                className="text-xs rounded-full p-0"
                            >
                                <CheckCheck className="!w-4.5 !h-4.5" />
                            </Button>
                        )}
                        {/* <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                            <X className="w-4 h-4" />
                        </Button> */}
                    </div>
                </div>

                <div className="max-h-[min(400px,70vh)] overflow-y-auto p-2">
                    {loading && filteredNotifications.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            Loading mentions...
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            No mentions to display
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(() => {
                                // Sort notifications by timestamp (newest first)
                                const sortedNotifications = [...filteredNotifications].sort(
                                    (a, b) => b.timestamp - a.timestamp
                                );

                                // Group notifications by server while preserving chronological order
                                const result: React.ReactNode[] = [];
                                let currentServer = '';

                                sortedNotifications.forEach((notification, index) => {
                                    // Add server header when server changes
                                    if (notification.serverName !== currentServer) {
                                        currentServer = notification.serverName;
                                        result.push(
                                            <div key={`server-${notification.serverId}-${index}`} className="text-sm font-semibold text-foreground px-2 pt-1 mt-2 first:mt-0">
                                                {notification.serverName}
                                            </div>
                                        );
                                    }

                                    // Add notification
                                    result.push(
                                        <div
                                            key={notification.notificationId}
                                            className={`p-2 rounded-md ${notification.read === 1
                                                ? 'bg-muted/30 text-muted-foreground'
                                                : 'bg-muted/60'} cursor-pointer transition-colors hover:bg-muted/80`}
                                            onClick={() => handleNotificationClick(notification)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className={`font-medium text-sm ${notification.read === 1 ? 'text-muted-foreground' : ''}`}>
                                                    {notification.authorName.length > 20 ? notification.authorName.slice(0, 20) + '...' : notification.authorName || shortenAddress(notification.authorId)}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    {formatTimestamp(notification.timestamp)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">#{notification.channelName}</div>
                                            <div className={`text-sm mt-1 break-words ${notification.read === 1 ? 'text-muted-foreground' : ''}`}>
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
            </PopoverContent>
        </Popover>
    );
}