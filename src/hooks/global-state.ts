import { create } from 'zustand'
import type { Server } from '@/lib/types'
import { useEffect } from 'react'
import { getServerInfo } from '@/lib/ao'
import { persist } from 'zustand/middleware'

// Storage keys
const STORAGE_KEY = 'subspace-server-cache'
const MESSAGE_CACHE_KEY = 'subspace-message-cache'

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000
// Message cache TTL (5 minutes)
const MESSAGE_CACHE_TTL = 5 * 60 * 1000

interface CachedServer {
    data: Server
    timestamp: number
}

interface CachedMessages {
    data: any[]  // Message array
    timestamp: number
}

// Helper functions for cache persistence
const loadServerCache = (): Map<string, CachedServer> => {
    try {
        const storedCache = localStorage.getItem(STORAGE_KEY)
        if (storedCache) {
            // Convert from JSON object to Map
            const parsed = JSON.parse(storedCache)
            return new Map(Object.entries(parsed))
        }
    } catch (error) {
        console.error('Failed to load server cache from storage:', error)
    }
    return new Map<string, CachedServer>()
}

const saveServerCache = (cache: Map<string, CachedServer>): void => {
    try {
        // Convert Map to an object for storage
        const cacheObj = Object.fromEntries(cache.entries())
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheObj))
    } catch (error) {
        console.error('Failed to save server cache to storage:', error)
    }
}

// Helper functions for message cache persistence
const loadMessageCache = (): Map<string, CachedMessages> => {
    try {
        const storedCache = localStorage.getItem(MESSAGE_CACHE_KEY)
        if (storedCache) {
            // Convert from JSON object to Map
            const parsed = JSON.parse(storedCache)
            return new Map(Object.entries(parsed))
        }
    } catch (error) {
        console.error('Failed to load message cache from storage:', error)
    }
    return new Map<string, CachedMessages>()
}

const saveMessageCache = (cache: Map<string, CachedMessages>): void => {
    try {
        // Convert Map to an object for storage
        const cacheObj = Object.fromEntries(cache.entries())
        localStorage.setItem(MESSAGE_CACHE_KEY, JSON.stringify(cacheObj))
    } catch (error) {
        console.error('Failed to save message cache to storage:', error)
    }
}

export interface GlobalState {
    activeServerId: string | null
    setActiveServerId: (server: string | null) => void
    activeServer: Server | null
    setActiveServer: (server: Server | null) => void
    activeChannelId: number | null
    setActiveChannelId: (channelId: number | null) => void
    fetchServerInfo: (serverId: string, forceRefresh?: boolean) => Promise<void>
    refreshServerData: () => Promise<void>  // New helper function
    isLoadingServer: boolean
    refreshingServers: Set<string>
    serverCache: Map<string, CachedServer>
    clearServerCache: () => void
    // Message caching
    messageCache: Map<string, CachedMessages>
    getChannelMessages: (channelId: number | null) => any[] | null
    cacheChannelMessages: (channelId: number | null, messages: any[]) => void
    clearMessageCache: () => void
    // Invalid server tracking
    invalidServerIds: Set<string>
    markServerAsInvalid: (serverId: string) => void
    isServerValid: (serverId: string) => boolean
}

export const useGlobalState = create<GlobalState>((set, get) => ({
    activeServerId: null,
    setActiveServerId: (serverId: string | null) => {
        set({ activeServerId: serverId });

        // Clear active server when serverId is null
        if (serverId === null) {
            set({
                activeServer: null,
                activeChannelId: null  // Also clear active channel when changing servers
            });
            return;
        }

        // Check cache first and set from cache if available
        const { serverCache } = get();
        if (serverCache.has(serverId)) {
            const cachedServer = serverCache.get(serverId);
            if (cachedServer) {
                set({ activeServer: cachedServer.data });

                // Background refresh if data is older than TTL
                const now = Date.now();
                if (now - cachedServer.timestamp > CACHE_TTL) {
                    get().fetchServerInfo(serverId, true);
                } else {
                    // Always perform a background refresh with lower priority
                    setTimeout(() => {
                        get().fetchServerInfo(serverId, true);
                    }, 1000);
                }
                return;
            }
        }

        // Fetch server info if not in cache
        get().fetchServerInfo(serverId);
    },
    activeServer: null,
    setActiveServer: (server: Server | null) => set({ activeServer: server }),

    // Add active channel state
    activeChannelId: null,
    setActiveChannelId: (channelId: number | null) => set({ activeChannelId: channelId }),

    isLoadingServer: false,
    refreshingServers: new Set<string>(),
    // Initialize with cached data from storage
    serverCache: loadServerCache(),
    clearServerCache: () => {
        // Clear both in-memory cache and storage
        set({ serverCache: new Map<string, CachedServer>() });
        localStorage.removeItem(STORAGE_KEY);
    },

    // Message cache implementation
    messageCache: loadMessageCache(),
    getChannelMessages: (channelId: number | null) => {
        if (!channelId) return null;
        const { activeServerId, messageCache } = get();
        if (!activeServerId) return null;

        const cacheKey = `${activeServerId}-${channelId}`;
        if (messageCache.has(cacheKey)) {
            const cachedMessages = messageCache.get(cacheKey);
            if (cachedMessages) {
                // Check if cache is still valid
                const now = Date.now();
                if (now - cachedMessages.timestamp <= MESSAGE_CACHE_TTL) {
                    return cachedMessages.data;
                }
            }
        }
        return null;
    },
    cacheChannelMessages: (channelId: number | null, messages: any[]) => {
        if (!channelId || !messages) return;
        const { activeServerId, messageCache } = get();
        if (!activeServerId) return;

        const cacheKey = `${activeServerId}-${channelId}`;
        const updatedCache = new Map(messageCache);
        updatedCache.set(cacheKey, {
            data: messages,
            timestamp: Date.now()
        });

        set({ messageCache: updatedCache });
        saveMessageCache(updatedCache);
    },
    clearMessageCache: () => {
        set({ messageCache: new Map<string, CachedMessages>() });
        localStorage.removeItem(MESSAGE_CACHE_KEY);
    },

    // Convenience method to refresh the current active server
    refreshServerData: async () => {
        const { activeServerId } = get();
        if (activeServerId) {
            console.log(`[refreshServerData] Refreshing server data for ${activeServerId}`);
            await get().fetchServerInfo(activeServerId, true);
        } else {
            console.log(`[refreshServerData] No active server to refresh`);
        }
    },

    // Add tracking for invalid server IDs
    invalidServerIds: new Set<string>(),

    markServerAsInvalid: (serverId: string) => {
        const { invalidServerIds } = get();
        const updatedInvalidServers = new Set(invalidServerIds);
        updatedInvalidServers.add(serverId);
        set({ invalidServerIds: updatedInvalidServers });

        // Optionally clear this server from cache
        const { serverCache } = get();
        if (serverCache.has(serverId)) {
            const updatedCache = new Map(serverCache);
            updatedCache.delete(serverId);
            set({ serverCache: updatedCache });
            saveServerCache(updatedCache);
        }

        console.log(`[markServerAsInvalid] Marked server as invalid: ${serverId}`);
    },

    isServerValid: (serverId: string) => {
        const { invalidServerIds } = get();
        return !invalidServerIds.has(serverId);
    },

    // Update the fetchServerInfo function to handle invalid servers
    fetchServerInfo: async (serverId: string, isBackgroundRefresh = false) => {
        if (!serverId) return;

        const { serverCache, refreshingServers, activeServerId, invalidServerIds } = get();

        // Skip if this server is already known to be invalid
        if (invalidServerIds.has(serverId)) {
            console.log(`[fetchServerInfo] Skipping fetch for invalid server: ${serverId}`);
            return;
        }

        // If this is already being refreshed, don't duplicate the request
        if (refreshingServers.has(serverId)) return;

        // For initial loads (not background), check and use cache if available
        if (!isBackgroundRefresh && serverCache.has(serverId)) {
            const cachedServer = serverCache.get(serverId);
            if (cachedServer) {
                set({ activeServer: cachedServer.data });
            }
        }

        try {
            // Only show loading indicator for non-background refreshes or when no cache exists
            if (!isBackgroundRefresh || !serverCache.has(serverId)) {
                set({ isLoadingServer: true });
            }

            // Mark this server as being refreshed
            const updatedRefreshing = new Set(refreshingServers);
            updatedRefreshing.add(serverId);
            set({ refreshingServers: updatedRefreshing });

            const serverInfo = await getServerInfo(serverId);

            // Update cache with new data and timestamp
            const updatedCache = new Map(serverCache);
            updatedCache.set(serverId, {
                data: serverInfo as Server,
                timestamp: Date.now()
            });

            // Save to browser storage
            saveServerCache(updatedCache);

            // Only update active server if this is still the active server
            const updates: Partial<GlobalState> = {
                serverCache: updatedCache,
                isLoadingServer: false
            };

            if (get().activeServerId === serverId) {
                updates.activeServer = serverInfo as Server;
            }

            // Remove from refreshing set
            const newRefreshing = new Set(get().refreshingServers);
            newRefreshing.delete(serverId);
            updates.refreshingServers = newRefreshing;

            set(updates);
        } catch (error) {
            console.error(`Failed to fetch server info for ${serverId}:`, error);

            // Mark server as invalid if we get specific errors that indicate the server doesn't exist
            // Examine error message to determine if this is a "server not found" type error
            const errorMessage = String(error).toLowerCase();
            if (
                errorMessage.includes("not found") ||
                errorMessage.includes("does not exist") ||
                errorMessage.includes("cannot read properties") ||
                errorMessage.includes("internal server error")
            ) {
                console.log(`[fetchServerInfo] Marking server as invalid due to error: ${serverId}`);
                get().markServerAsInvalid(serverId);
            }

            // Remove from refreshing set on error too
            const newRefreshing = new Set(get().refreshingServers);
            newRefreshing.delete(serverId);
            set({
                isLoadingServer: !isBackgroundRefresh,
                refreshingServers: newRefreshing
            });
        }
    }
}))

// Hook to synchronize server ID with server data
export function useServerSync() {
    const { activeServerId, fetchServerInfo, serverCache } = useGlobalState();

    useEffect(() => {
        if (activeServerId) {
            const hasCache = serverCache.has(activeServerId);
            // Still fetch but use cache in the meantime
            fetchServerInfo(activeServerId, hasCache);
        }
    }, [activeServerId]);
}

// Hook to manage cache persistence
export function useCachePersistence() {
    const { serverCache, messageCache } = useGlobalState();

    // Save cache to localStorage whenever it changes
    useEffect(() => {
        saveServerCache(serverCache);
    }, [serverCache]);

    // Save message cache to localStorage whenever it changes
    useEffect(() => {
        saveMessageCache(messageCache);
    }, [messageCache]);
}

