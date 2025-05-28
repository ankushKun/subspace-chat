import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SubspaceNotification } from "@/types/subspace";

interface NotificationState {
    notifications: SubspaceNotification[];
    loading: boolean;
    unreadCount: number;
    unreadByServer: Record<string, Set<string>>; // serverId -> Set<channelId>
    unreadCountsByServer: Record<string, number>;
    unreadCountsByChannel: Record<string, Record<string, number>>;
    currentUserId: string | null;

    actions: NotificationActions;
}

interface NotificationActions {
    setNotifications: (notifications: SubspaceNotification[]) => void;
    addNotifications: (notifications: SubspaceNotification[]) => void;
    markNotificationsAsRead: (serverId: string, channelId: number) => void;
    markNotificationAsRead: (notificationId: number) => void;
    setLoading: (loading: boolean) => void;
    clearNotifications: () => void;
    updateUnreadCounts: (joinedServers: string[]) => void;
    setCurrentUserId: (userId: string | null) => void;
    getCurrentUserNotifications: () => SubspaceNotification[];
}

const MAX_STORED_NOTIFICATIONS = 200;

export const useNotifications = create<NotificationState>()(persist((set, get) => ({
    notifications: [],
    loading: false,
    unreadCount: 0,
    unreadByServer: {},
    unreadCountsByServer: {},
    unreadCountsByChannel: {},
    currentUserId: null,

    actions: {
        setNotifications: (notifications: SubspaceNotification[]) => {
            // Sort by timestamp (newest first) and limit to MAX_STORED_NOTIFICATIONS
            const sortedNotifications = notifications
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_STORED_NOTIFICATIONS);

            set({ notifications: sortedNotifications });

            // Update unread counts
            get().actions.updateUnreadCounts([]);
        },

        addNotifications: (newNotifications: SubspaceNotification[]) => {
            set((state) => {
                // Filter out duplicates
                const existingIds = new Set(state.notifications.map(n => n.notificationId));
                const uniqueNewNotifications = newNotifications.filter(n => !existingIds.has(n.notificationId));

                // Combine and sort
                const allNotifications = [...state.notifications, ...uniqueNewNotifications]
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, MAX_STORED_NOTIFICATIONS);

                return { notifications: allNotifications };
            });

            // Update unread counts
            get().actions.updateUnreadCounts([]);
        },

        markNotificationsAsRead: (serverId: string, channelId: number) => {
            set((state) => ({
                notifications: state.notifications.map(notification =>
                    notification.serverId === serverId &&
                        notification.channelId === channelId &&
                        notification.read === 0
                        ? { ...notification, read: 1 }
                        : notification
                )
            }));

            // Update unread counts
            get().actions.updateUnreadCounts([]);
        },

        markNotificationAsRead: (notificationId: number) => {
            set((state) => ({
                notifications: state.notifications.map(notification =>
                    notification.notificationId === notificationId
                        ? { ...notification, read: 1 }
                        : notification
                )
            }));

            // Update unread counts
            get().actions.updateUnreadCounts([]);
        },

        setLoading: (loading: boolean) => set({ loading }),

        clearNotifications: () => set({
            notifications: [],
            unreadCount: 0,
            unreadByServer: {},
            unreadCountsByServer: {},
            unreadCountsByChannel: {}
        }),

        updateUnreadCounts: (joinedServers: string[]) => {
            const state = get();
            const currentUserNotifications = state.actions.getCurrentUserNotifications();
            const unreadByServer: Record<string, Set<string>> = {};
            const unreadCountsByServer: Record<string, number> = {};
            const unreadCountsByChannel: Record<string, Record<string, number>> = {};

            let totalUnreadCount = 0;

            currentUserNotifications.forEach(notification => {
                // Only count notifications from joined servers and that are unread
                if (notification.read === 0 && (joinedServers.length === 0 || joinedServers.includes(notification.serverId))) {
                    const serverId = notification.serverId;
                    const channelId = notification.channelId.toString();

                    // Initialize server tracking
                    if (!unreadByServer[serverId]) {
                        unreadByServer[serverId] = new Set();
                        unreadCountsByServer[serverId] = 0;
                        unreadCountsByChannel[serverId] = {};
                    }

                    // Add channel to server's unread channels
                    unreadByServer[serverId].add(channelId);

                    // Increment server count
                    unreadCountsByServer[serverId]++;

                    // Increment channel count
                    if (!unreadCountsByChannel[serverId][channelId]) {
                        unreadCountsByChannel[serverId][channelId] = 0;
                    }
                    unreadCountsByChannel[serverId][channelId]++;

                    totalUnreadCount++;
                }
            });

            set({
                unreadCount: totalUnreadCount,
                unreadByServer,
                unreadCountsByServer,
                unreadCountsByChannel
            });
        },

        setCurrentUserId: (userId: string | null) => {
            set({ currentUserId: userId });
            // Update unread counts when user changes
            get().actions.updateUnreadCounts([]);
        },

        getCurrentUserNotifications: () => {
            const state = get();
            if (!state.currentUserId) return [];
            return state.notifications.filter(notification => notification.userId === state.currentUserId);
        }
    }
}), {
    name: "subspace-notifications",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        notifications: state.notifications,
        currentUserId: state.currentUserId
    })
})); 