import { create } from 'zustand'
import type { Server } from '@/lib/types'
import { useEffect } from 'react'
import { getServerInfo } from '@/lib/ao'
import { persist } from 'zustand/middleware'

// Storage keys
const STORAGE_KEY = 'subspace-server-cache'

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000

interface CachedServer {
    data: Server
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

export interface GlobalState {
    activeServerId: string | null
    setActiveServerId: (serverId: string | null) => void
    activeServer: Server | null
    setActiveServer: (server: Server | null) => void
    fetchServerInfo: (serverId: string, forceRefresh?: boolean) => Promise<void>
    isLoadingServer: boolean
    refreshingServers: Set<string>
    serverCache: Map<string, CachedServer>
    clearServerCache: () => void
}

export const useGlobalState = create<GlobalState>((set, get) => ({
    activeServerId: null,
    setActiveServerId: (serverId: string | null) => {
        set({ activeServerId: serverId });

        // Clear active server when serverId is null
        if (serverId === null) {
            set({ activeServer: null });
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
    isLoadingServer: false,
    refreshingServers: new Set<string>(),
    // Initialize with cached data from storage
    serverCache: loadServerCache(),
    clearServerCache: () => {
        // Clear both in-memory cache and storage
        set({ serverCache: new Map<string, CachedServer>() });
        localStorage.removeItem(STORAGE_KEY);
    },
    fetchServerInfo: async (serverId: string, isBackgroundRefresh = false) => {
        if (!serverId) return;

        const { serverCache, refreshingServers, activeServerId } = get();

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
            console.error('Failed to fetch server info:', error);
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
    const { serverCache } = useGlobalState();

    // Save cache to localStorage whenever it changes
    useEffect(() => {
        saveServerCache(serverCache);
    }, [serverCache]);
}

