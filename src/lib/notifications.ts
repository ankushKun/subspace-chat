import { getNotifications as fetchNotificationsFromAO, markNotificationsAsRead as markAONotificationsAsRead } from './ao';
import { createLogger } from './logger';
import { sendNotification } from './utils';

const logger = createLogger('notifications');

// Define notification types
export interface Notification {
    id: string;
    recipient: string;
    SID: string;
    CID: string;
    MID: string;
    author: string;
    content: string;
    channel: string;
    server: string;
    timestamp: string;
    isRead: boolean;
}

// Storage for notifications
const MAX_STORED_NOTIFICATIONS = 200;

// Central notification manager
class NotificationManager {
    private notifications: Map<string, Notification[]> = new Map();
    private listeners: Set<() => void> = new Set();
    private fetchInProgress: Map<string, boolean> = new Map();
    private lastFetchTime: Map<string, number> = new Map();
    private seenIds: Set<string> = new Set();
    private fetchInterval = 4000; // 4 seconds
    private fetchTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        // Load seen notification IDs from localStorage
        this.loadSeenIds();
    }

    // Load seen IDs from localStorage
    private loadSeenIds(): void {
        try {
            const seenIdsJson = localStorage.getItem('notifications-seen-ids');
            if (seenIdsJson) {
                const ids = JSON.parse(seenIdsJson);
                ids.forEach((id: string) => this.seenIds.add(id));
                logger.info(`Loaded ${this.seenIds.size} seen notification IDs`);
            }
        } catch (error) {
            logger.warn('Error loading seen notification IDs:', error);
        }
    }

    // Save seen IDs to localStorage
    private saveSeenIds(): void {
        try {
            const idsArray = Array.from(this.seenIds);
            // Only keep the most recent 500 IDs
            const recentIds = idsArray.slice(-500);
            localStorage.setItem('notifications-seen-ids', JSON.stringify(recentIds));
        } catch (error) {
            logger.warn('Error saving seen notification IDs:', error);
        }
    }

    // Load notifications from localStorage
    private loadNotifications(address: string): void {
        try {
            const storedNotifications = localStorage.getItem(`notifications-${address}`);
            if (storedNotifications) {
                this.notifications.set(address, JSON.parse(storedNotifications));
                logger.info(`Loaded notifications for ${address} from localStorage`);
                this.notifyListeners();
            }
        } catch (error) {
            logger.warn(`Error loading notifications for ${address}:`, error);
        }
    }

    // Save notifications to localStorage
    private saveNotifications(address: string): void {
        try {
            const userNotifications = this.notifications.get(address);
            if (userNotifications) {
                localStorage.setItem(`notifications-${address}`, JSON.stringify(userNotifications));
                logger.info(`Saved notifications for ${address} to localStorage`);
            }
        } catch (error) {
            logger.warn(`Error saving notifications for ${address}:`, error);
        }
    }

    // Get notifications for a user
    public getNotifications(address: string): Notification[] {
        // Check if we have notifications for this address in memory
        if (!this.notifications.has(address)) {
            // Load from localStorage if available
            this.loadNotifications(address);

            // If still not available, return empty array and start fetching
            if (!this.notifications.has(address)) {
                this.notifications.set(address, []);
                // Trigger an immediate fetch if this is the first request
                this.fetchNotifications(address, true);
            }
        }

        return this.notifications.get(address) || [];
    }

    // Format message content to simplify mentions
    private formatMessageContent(content: string): string {
        if (!content) return "";
        // Replace @[name](address) with @name
        return content.replace(/@\[(.*?)\]\((.*?)\)/g, '@$1');
    }

    // Fetch notifications from AO
    public async fetchNotifications(address: string, immediate = false): Promise<void> {
        // Check if fetch already in progress
        if (this.fetchInProgress.get(address)) {
            return;
        }

        // Check if we need to throttle requests
        const now = Date.now();
        const lastFetch = this.lastFetchTime.get(address) || 0;
        if (!immediate && now - lastFetch < this.fetchInterval) {
            return;
        }

        // Mark fetch as in progress
        this.fetchInProgress.set(address, true);
        this.lastFetchTime.set(address, now);

        try {
            logger.info(`Fetching notifications for ${address}`);

            // Check user preference
            const notificationsEnabled = localStorage.getItem('notifications-enabled') !== 'false';
            if (!notificationsEnabled) {
                logger.info('Notifications disabled by user preference');
                return;
            }

            // Fetch notifications from AO
            const result = await fetchNotificationsFromAO(address);

            // Skip if no data or no messages
            if (!result || !result.messages || result.messages.length === 0) {
                logger.info('No new notifications');
                return;
            }

            // Mark notifications as unread
            const serverNotifications = result.messages.map(notification => ({
                ...notification,
                isRead: false
            })) as Notification[];

            // Filter out already seen notifications
            const existingNotifications = this.notifications.get(address) || [];
            const newMessages = serverNotifications.filter(notification => {
                // Skip if we've already seen this notification
                if (this.seenIds.has(notification.id)) {
                    return false;
                }

                // Skip if notification already in memory
                if (existingNotifications.some(n => n.id === notification.id)) {
                    return false;
                }

                // Mark as seen
                this.seenIds.add(notification.id);
                return true;
            });

            // Save seen IDs
            if (newMessages.length > 0) {
                this.saveSeenIds();
            }

            // Update notifications
            if (newMessages.length > 0) {
                // Combine with existing notifications
                const updatedNotifications = [...existingNotifications, ...newMessages];

                // Sort by timestamp (newest first)
                updatedNotifications.sort((a, b) =>
                    parseInt(b.timestamp) - parseInt(a.timestamp)
                );

                // Limit to MAX_STORED_NOTIFICATIONS
                const limitedNotifications = updatedNotifications.slice(0, MAX_STORED_NOTIFICATIONS);

                // Update in-memory storage
                this.notifications.set(address, limitedNotifications);

                // Save to localStorage
                this.saveNotifications(address);

                // Notify listeners
                this.notifyListeners();

                // Send system notifications
                this.sendSystemNotifications(newMessages);
            }
        } catch (error) {
            logger.error(`Error fetching notifications for ${address}:`, error);
        } finally {
            this.fetchInProgress.set(address, false);
        }
    }

    // Send system notifications
    private sendSystemNotifications(notifications: Notification[]): void {
        if (notifications.length === 0) return;

        // Group messages by server
        const messagesByServer = notifications.reduce((acc, message) => {
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
        }, {} as Record<string, { serverName: string; messages: Notification[] }>);

        // Send notifications
        Object.entries(messagesByServer).forEach(([serverId, data]) => {
            if (!data) return;

            const { serverName = 'Unknown Server', messages = [] } = data;

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
                    const formattedContent = this.formatMessageContent(message.content);

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
    }

    // Mark notifications as read
    public async markAsRead(serverId: string, channelId: number, address: string): Promise<void> {
        try {
            logger.info(`Marking notifications as read for ${serverId}/${channelId}`);

            // Call AO to mark as read
            await markAONotificationsAsRead(serverId, channelId);

            // Update local state
            const userNotifications = this.notifications.get(address);
            if (userNotifications) {
                const updatedNotifications = userNotifications.map(n => {
                    if (n.SID === serverId && n.CID === channelId.toString() && !n.isRead) {
                        return { ...n, isRead: true };
                    }
                    return n;
                });

                // Update in-memory storage
                this.notifications.set(address, updatedNotifications);

                // Save to localStorage
                this.saveNotifications(address);

                // Notify listeners
                this.notifyListeners();
            }
        } catch (error) {
            logger.error(`Error marking notifications as read:`, error);
        }
    }

    // Start polling for notifications
    public startPolling(address: string): void {
        // Stop existing polling
        this.stopPolling(address);

        // Set up new polling
        const timer = setInterval(() => {
            this.fetchNotifications(address);
        }, this.fetchInterval);

        this.fetchTimers.set(address, timer);
    }

    // Stop polling for notifications
    public stopPolling(address: string): void {
        const timer = this.fetchTimers.get(address);
        if (timer) {
            clearInterval(timer);
            this.fetchTimers.delete(address);
        }
    }

    // Add a change listener
    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);

        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    // Notify all listeners
    private notifyListeners(): void {
        this.listeners.forEach(listener => {
            try {
                listener();
            } catch (error) {
                logger.error('Error in notification listener:', error);
            }
        });
    }

    // Get unread count
    public getUnreadCount(address: string, serverId?: string, channelId?: string): number {
        const userNotifications = this.notifications.get(address) || [];

        return userNotifications.filter(n => {
            if (n.isRead) return false;

            if (serverId && n.SID !== serverId) return false;

            if (channelId && n.CID !== channelId.toString()) return false;

            return true;
        }).length;
    }

    // Check if there are unread notifications
    public hasUnread(address: string, serverId?: string, channelId?: string): boolean {
        return this.getUnreadCount(address, serverId, channelId) > 0;
    }
}

// Create singleton instance
export const notificationManager = new NotificationManager();

// Export direct methods
export const getNotifications = (address: string) => notificationManager.getNotifications(address);
export const fetchNotifications = (address: string) => notificationManager.fetchNotifications(address);
export const markNotificationsAsRead = (serverId: string, channelId: number, address: string) =>
    notificationManager.markAsRead(serverId, channelId, address);
export const startNotificationPolling = (address: string) => notificationManager.startPolling(address);
export const stopNotificationPolling = (address: string) => notificationManager.stopPolling(address);
export const subscribeToNotifications = (listener: () => void) => notificationManager.subscribe(listener);
export const getUnreadNotificationCount = (address: string, serverId?: string, channelId?: string) =>
    notificationManager.getUnreadCount(address, serverId, channelId);
export const hasUnreadNotifications = (address: string, serverId?: string, channelId?: string) =>
    notificationManager.hasUnread(address, serverId, channelId); 