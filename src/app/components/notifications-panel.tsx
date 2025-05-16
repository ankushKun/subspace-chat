import { useEffect, useState } from "react";
import { getNotifications, markNotificationsAsRead } from "@/lib/ao";
import { useNavigate } from "react-router-dom";
import { useGlobalState } from "@/hooks/global-state";
import { useActiveAddress } from "arwalletkit-react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BiSolidInbox } from "react-icons/bi";

interface Notification {
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
    const { setActiveServerId, setActiveChannelId } = useGlobalState();
    const address = useActiveAddress();

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

    // Fetch notifications and merge with local storage
    useEffect(() => {
        if (!address) return;

        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const result = await getNotifications(address);

                if (!result.messages || !Array.isArray(result.messages)) {
                    setLoading(false);
                    return;
                }

                // Mark server notifications as unread
                const serverNotifications = result.messages.map((notification: any) => ({
                    ...notification,
                    isRead: false
                }));

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
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();

        // Set up polling interval
        const intervalId = setInterval(fetchNotifications, 5000);

        return () => clearInterval(intervalId);
    }, [address]);

    // Count unread notifications
    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Group notifications by server
    const notificationsByServer = notifications.reduce((acc, notification) => {
        if (!acc[notification.SID]) {
            acc[notification.SID] = {
                serverName: notification.server,
                notifications: []
            };
        }

        acc[notification.SID].notifications.push(notification);
        return acc;
    }, {} as Record<string, { serverName: string; notifications: Notification[] }>);

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
        return content.replace(/@\[(.*?)\]\((.*?)\)/g, '@$1');
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
                <div className="absolute right-0 top-full mt-0 w-80 bg-background/60 backdrop-blur-2xl border border-border rounded-lg shadow-lg z-50">
                    <div className="flex items-center justify-between p-3 border-b border-border">
                        <h3 className="font-medium">Mentions</h3>
                        <button onClick={() => setOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto p-2">
                        {notifications.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                                No mentions to display
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(notificationsByServer).map(([serverId, { serverName, notifications }]) => (
                                    <div key={serverId} className="space-y-1">
                                        <div className="text-sm font-semibold text-foreground px-2 pt-1">{serverName}</div>
                                        {notifications
                                            .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
                                            .map(notification => (
                                                <div
                                                    key={notification.id}
                                                    className={`p-2 rounded-md ${notification.isRead
                                                        ? 'bg-muted/30 text-muted-foreground'
                                                        : 'bg-muted/60'} cursor-pointer transition-colors hover:bg-muted/80`}
                                                    onClick={() => handleNotificationClick(notification)}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className={`font-medium text-sm ${notification.isRead ? 'text-muted-foreground' : ''}`}>
                                                            {notification.author}
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
                                            ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
} 