import { create } from 'zustand'
import type { Server, Member } from '@/lib/types'
import { useEffect, useState, useRef } from 'react'
import { getServerInfo, getMembers, getJoinedServers, getProfile } from '@/lib/ao'
import { persist } from 'zustand/middleware'
import type { WanderConnect } from '@wanderapp/connect'

// Define API response interfaces
interface MembersResponse {
    success: boolean;
    members: Member[];
}

// Storage keys
const STORAGE_KEY = 'subspace-server-cache'
const MESSAGE_CACHE_KEY = 'subspace-message-cache'
const MEMBERS_CACHE_KEY = 'subspace-members-cache'
const USER_PROFILE_CACHE_KEY = 'subspace-user-profile-cache'
const SERVER_LIST_CACHE_KEY = 'subspace-server-list-cache'
const USER_PROFILES_CACHE_KEY = 'subspace-user-profiles-cache'

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000
// Message cache TTL (5 minutes)
const MESSAGE_CACHE_TTL = 5 * 60 * 1000
// Members cache TTL (10 minutes)
const MEMBERS_CACHE_TTL = 10 * 60 * 1000
// User profile cache TTL (30 minutes)
const USER_PROFILE_CACHE_TTL = 30 * 60 * 1000
// Server list cache TTL (15 minutes)
const SERVER_LIST_CACHE_TTL = 15 * 60 * 1000
// User profiles cache TTL (15 minutes)
const USER_PROFILES_CACHE_TTL = 15 * 60 * 1000

interface CachedServer {
    data: Server
    timestamp: number
}

interface CachedMessages {
    data: any[]  // Message array
    timestamp: number
}

interface CachedMembers {
    data: Member[]
    timestamp: number
}

// Define interface for cached user profile
interface CachedUserProfile {
    data: any;  // Profile data
    timestamp: number;
}

// Define interface for cached server list
interface CachedServerList {
    data: string[];  // Array of server IDs
    address: string; // The address this list belongs to
    timestamp: number;
}

// Define interface for user profiles cache
interface CachedUserProfiles {
    [userId: string]: {
        username?: string;   // User's display name
        pfp?: string;        // Profile picture ID
        primaryName?: string; // User's primary name from ArNS
        timestamp: number;   // When this profile was cached
    };
}

// Unread notifications
interface UnreadNotificationData {
    serverChannelMap: Record<string, Set<string>>;
    serverCounts: Record<string, number>;
    channelCounts: Record<string, Record<string, number>>;
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

// Helper functions for members cache persistence
const loadMembersCache = (): Map<string, CachedMembers> => {
    try {
        const storedCache = localStorage.getItem(MEMBERS_CACHE_KEY)
        if (storedCache) {
            // Convert from JSON object to Map
            const parsed = JSON.parse(storedCache)
            return new Map(Object.entries(parsed))
        }
    } catch (error) {
        console.error('Failed to load members cache from storage:', error)
    }
    return new Map<string, CachedMembers>()
}

const saveMembersCache = (cache: Map<string, CachedMembers>): void => {
    try {
        // Convert Map to an object for storage
        const cacheObj = Object.fromEntries(cache.entries())
        localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(cacheObj))
    } catch (error) {
        console.error('Failed to save members cache to storage:', error)
    }
}

// Helper function to load user profile from storage
const loadUserProfileCache = (): CachedUserProfile | null => {
    try {
        const storedCache = localStorage.getItem(USER_PROFILE_CACHE_KEY)
        if (storedCache) {
            return JSON.parse(storedCache)
        }
    } catch (error) {
        console.error('Failed to load user profile cache from storage:', error)
    }
    return null
}

// Helper function to save user profile to storage
const saveUserProfileCache = (cache: CachedUserProfile): void => {
    try {
        localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(cache))
    } catch (error) {
        console.error('Failed to save user profile cache to storage:', error)
    }
}

// Helper function to load server list from storage
const loadServerListCache = (): CachedServerList | null => {
    try {
        const storedCache = localStorage.getItem(SERVER_LIST_CACHE_KEY)
        if (storedCache) {
            return JSON.parse(storedCache)
        }
    } catch (error) {
        console.error('Failed to load server list cache from storage:', error)
    }
    return null
}

// Helper function to save server list to storage
const saveServerListCache = (cache: CachedServerList): void => {
    try {
        localStorage.setItem(SERVER_LIST_CACHE_KEY, JSON.stringify(cache))
    } catch (error) {
        console.error('Failed to save server list cache to storage:', error)
    }
}

// Helper function to load user profiles from storage
const loadUserProfilesCache = (): CachedUserProfiles => {
    try {
        const storedCache = localStorage.getItem(USER_PROFILES_CACHE_KEY)
        if (storedCache) {
            return JSON.parse(storedCache)
        }
    } catch (error) {
        console.error('Failed to load user profiles cache from storage:', error)
    }
    return {}
}

// Helper function to save user profiles to storage
const saveUserProfilesCache = (cache: CachedUserProfiles): void => {
    try {
        localStorage.setItem(USER_PROFILES_CACHE_KEY, JSON.stringify(cache))
    } catch (error) {
        console.error('Failed to save user profiles cache to storage:', error)
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

    // Member management
    serverMembers: Map<string, CachedMembers>
    isLoadingMembers: boolean
    fetchServerMembers: (serverId: string, forceRefresh?: boolean) => Promise<void>
    getServerMembers: (serverId: string) => Member[] | null
    updateMemberNickname: (serverId: string, memberId: string, nickname: string) => void

    // Background loading
    prefetchAllServerData: (address: string) => Promise<void>
    isPrefetchingData: boolean

    showUsers: boolean
    setShowUsers: (show: boolean) => void

    wanderInstance: WanderConnect | null
    setWanderInstance: (instance: WanderConnect | null) => void

    // Track servers with invalid member endpoints
    invalidMemberServers: Set<string>

    // User profile management
    userProfile: CachedUserProfile | null
    setUserProfile: (profileData: any) => void
    getUserProfile: () => any | null
    clearUserProfileCache: () => void
    fetchUserProfile: (address: string, forceRefresh?: boolean) => Promise<any | null>

    // Server list caching
    serverListCache: CachedServerList | null
    fetchJoinedServers: (address: string, forceRefresh?: boolean) => Promise<string[]>
    cacheServerList: (address: string, serverIds: string[]) => void
    clearServerListCache: () => void

    // User profiles cache - for all users
    userProfilesCache: CachedUserProfiles
    getUserProfileFromCache: (userId: string) => { username?: string, pfp?: string, primaryName?: string, timestamp: number } | null
    updateUserProfileCache: (userId: string, profile: { username?: string, pfp?: string, primaryName?: string, timestamp: number }) => void
    fetchUserProfileAndCache: (userId: string, forceRefresh?: boolean) => Promise<any | null>
    clearUserProfilesCache: () => void

    // Unread notifications
    unreadNotifications: UnreadNotificationData
    setUnreadNotifications: (unread: UnreadNotificationData) => void
    hasUnreadNotifications: (serverId: string, channelId?: string) => boolean
    getUnreadCount: (serverId: string, channelId?: string) => number
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

                // Load server members in the background
                get().fetchServerMembers(serverId);

                return;
            }
        }

        // Fetch server info if not in cache
        get().fetchServerInfo(serverId);

        // Load server members in the background
        get().fetchServerMembers(serverId);
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

    // Server list cache implementation
    serverListCache: loadServerListCache(),

    fetchJoinedServers: async (address: string, forceRefresh = false) => {
        if (!address) return [];

        const { serverListCache } = get();
        const now = Date.now();

        // Use cache if available and not expired, and if this is the same user
        if (!forceRefresh &&
            serverListCache &&
            serverListCache.address === address &&
            now - serverListCache.timestamp <= SERVER_LIST_CACHE_TTL) {
            console.log(`[fetchJoinedServers] Using cached server list for ${address}`);
            return serverListCache.data;
        }

        try {
            console.log(`[fetchJoinedServers] Fetching joined servers for ${address}`);
            const serverIds = await getJoinedServers(address);

            // Cache the result
            get().cacheServerList(address, serverIds);

            return serverIds;
        } catch (error) {
            console.error(`[fetchJoinedServers] Error fetching joined servers:`, error);

            // If we have cached data for this user, return it even if expired
            if (serverListCache && serverListCache.address === address) {
                console.log(`[fetchJoinedServers] Using expired cache as fallback`);
                return serverListCache.data;
            }

            return [];
        }
    },

    cacheServerList: (address: string, serverIds: string[]) => {
        const cachedServerList = {
            data: serverIds,
            address: address,
            timestamp: Date.now()
        };

        set({ serverListCache: cachedServerList });
        saveServerListCache(cachedServerList);
    },

    clearServerListCache: () => {
        set({ serverListCache: null });
        localStorage.removeItem(SERVER_LIST_CACHE_KEY);
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
            // Also refresh members data
            await get().fetchServerMembers(activeServerId, true);
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

    // Member management
    serverMembers: loadMembersCache(),
    isLoadingMembers: false,
    // Track servers with invalid member endpoints
    invalidMemberServers: new Set<string>(),

    // Add function to update a single member's nickname in the cache
    updateMemberNickname: (serverId: string, memberId: string, nickname: string) => {
        if (!serverId || !memberId) return;

        const { serverMembers } = get();
        const cachedServerMembers = serverMembers.get(serverId);

        // If we don't have cached members for this server, do nothing
        if (!cachedServerMembers || !cachedServerMembers.data) return;

        // Find and update the member's nickname
        const updatedMembers = [...cachedServerMembers.data];
        const memberIndex = updatedMembers.findIndex(m => m.id === memberId);

        if (memberIndex !== -1) {
            // Update the nickname
            updatedMembers[memberIndex] = {
                ...updatedMembers[memberIndex],
                nickname: nickname
            };

            // Update the cache with the new members array
            const updatedCache = new Map(serverMembers);
            updatedCache.set(serverId, {
                data: updatedMembers,
                timestamp: Date.now() // Update timestamp to reflect the change
            });

            // Save to storage
            saveMembersCache(updatedCache);

            // Update state
            set({ serverMembers: updatedCache });

            console.log(`[updateMemberNickname] Updated nickname for member ${memberId} in server ${serverId}`);
        } else {
            console.log(`[updateMemberNickname] Member ${memberId} not found in server ${serverId} cache`);
        }
    },

    fetchServerMembers: async (serverId: string, forceRefresh = false) => {
        if (!serverId) return;
        const { serverMembers, invalidServerIds, invalidMemberServers } = get();

        // Skip if this server is already known to be invalid
        if (invalidServerIds.has(serverId)) {
            console.log(`[fetchServerMembers] Skipping fetch for invalid server: ${serverId}`);
            return;
        }

        // When forceRefresh is true, we'll retry even if previously marked as invalid
        // ONLY if it's explicitly a user action (isLoadingServer is true)
        if (invalidMemberServers.has(serverId) && (!forceRefresh || !get().isLoadingServer)) {
            console.log(`[fetchServerMembers] Skipping fetch for server with invalid members endpoint: ${serverId}`);
            return;
        }

        // If this is a force refresh from a user action for a server previously marked as invalid,
        // remove it from the invalid set to allow retrying
        if (forceRefresh && invalidMemberServers.has(serverId) && get().isLoadingServer) {
            console.log(`[fetchServerMembers] Retrying previously invalid member server due to user action: ${serverId}`);
            const updatedInvalidMemberServers = new Set(invalidMemberServers);
            updatedInvalidMemberServers.delete(serverId);
            set({
                invalidMemberServers: updatedInvalidMemberServers
            });
        }

        // Check if we have cached members and if the cache is still valid
        const cachedMembers = serverMembers.get(serverId);
        const now = Date.now();

        if (!forceRefresh && cachedMembers && now - cachedMembers.timestamp <= MEMBERS_CACHE_TTL) {
            console.log(`[fetchServerMembers] Using cached members for ${serverId}`);
            return;
        }

        try {
            set({ isLoadingMembers: true });
            console.log(`[fetchServerMembers] Fetching members for ${serverId}`);

            const response = await getMembers(serverId) as MembersResponse;

            if (response?.success && Array.isArray(response.members)) {
                // Update cached members
                const updatedCache = new Map(get().serverMembers);
                updatedCache.set(serverId, {
                    data: response.members,
                    timestamp: now
                });

                // Save to storage
                saveMembersCache(updatedCache);

                // Update state
                set({
                    serverMembers: updatedCache,
                    isLoadingMembers: false
                });

                console.log(`[fetchServerMembers] Successfully fetched ${response.members.length} members for ${serverId}`);
            } else {
                console.error(`[fetchServerMembers] Invalid response format for ${serverId}:`, response);
                // Mark this server as having an invalid member endpoint
                const updatedInvalidMemberServers = new Set(get().invalidMemberServers);
                updatedInvalidMemberServers.add(serverId);
                set({
                    invalidMemberServers: updatedInvalidMemberServers,
                    isLoadingMembers: false
                });
            }
        } catch (error) {
            console.error(`[fetchServerMembers] Error fetching members for ${serverId}:`, error);
            // Mark this server as having an invalid member endpoint
            const updatedInvalidMemberServers = new Set(get().invalidMemberServers);
            updatedInvalidMemberServers.add(serverId);
            set({
                invalidMemberServers: updatedInvalidMemberServers,
                isLoadingMembers: false
            });
        }
    },

    getServerMembers: (serverId: string) => {
        if (!serverId) return null;

        const { serverMembers, invalidMemberServers } = get();
        const cachedMembers = serverMembers.get(serverId);

        // If this server is known to have an invalid members endpoint,
        // BUT we have cached data, return the cached data instead
        if (invalidMemberServers.has(serverId)) {
            if (cachedMembers) {
                console.log(`[getServerMembers] Using cached data for server with invalid members endpoint: ${serverId}`);
                return cachedMembers.data;
            }
            // Only return empty array if we have no cached data
            return [];
        }

        if (cachedMembers) {
            // Check if cache is still valid
            const now = Date.now();
            if (now - cachedMembers.timestamp <= MEMBERS_CACHE_TTL) {
                return cachedMembers.data;
            }

            // If cache expired, trigger a background refresh
            get().fetchServerMembers(serverId, true);

            // Still return the cached data while we refresh
            return cachedMembers.data;
        }

        // If no cache, trigger a fetch and return null for now
        get().fetchServerMembers(serverId);
        return null;
    },

    // Background prefetching for all servers
    isPrefetchingData: false,

    prefetchAllServerData: async (address: string) => {
        const { isPrefetchingData, isServerValid, serverCache, fetchServerInfo, fetchServerMembers, fetchJoinedServers } = get();

        // Avoid multiple concurrent prefetches
        if (isPrefetchingData) return;

        try {
            set({ isPrefetchingData: true });
            console.log('[prefetchAllServerData] Starting background prefetch of all server data');

            // Get list of joined servers
            const serverIds = await fetchJoinedServers(address, false);
            console.log(`[prefetchAllServerData] Found ${serverIds.length} servers to prefetch`);

            if (serverIds.length === 0) {
                set({ isPrefetchingData: false });
                return;
            }

            // Process servers with a slight delay between each to avoid overwhelming API
            for (const serverId of serverIds) {
                // Skip invalid servers
                if (!isServerValid(serverId)) continue;

                // Check if we need to refresh this server's data
                const cachedServer = serverCache.get(serverId);
                const now = Date.now();
                const needsRefresh = !cachedServer || (now - cachedServer.timestamp > CACHE_TTL);

                if (needsRefresh) {
                    console.log(`[prefetchAllServerData] Prefetching server ${serverId}`);
                    await fetchServerInfo(serverId, true);
                    // Small delay to avoid overwhelming the API
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Also fetch members data
                    await fetchServerMembers(serverId);
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    console.log(`[prefetchAllServerData] Using cached data for ${serverId}`);
                    // Even if we have cached data, we might still want to update member info
                    fetchServerMembers(serverId, false);
                }
            }
        } catch (error) {
            console.error('[prefetchAllServerData] Error prefetching server data:', error);
        } finally {
            set({ isPrefetchingData: false });
            console.log('[prefetchAllServerData] Background prefetch completed');
        }
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

            // Start loading members in the background
            if (get().activeServerId === serverId) {
                get().fetchServerMembers(serverId);
            }
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
    },
    showUsers: false,
    setShowUsers: (show: boolean) => set({ showUsers: show }),

    wanderInstance: null,
    setWanderInstance: (instance: WanderConnect | null) => set({ wanderInstance: instance }),

    // User profile state implementation
    userProfile: loadUserProfileCache(),

    setUserProfile: (profileData: any) => {
        const userProfile = {
            data: profileData,
            timestamp: Date.now()
        };

        set({ userProfile });
        saveUserProfileCache(userProfile);
    },

    getUserProfile: () => {
        const { userProfile } = get();
        if (!userProfile) return null;

        // Check if cache is still valid
        const now = Date.now();
        if (now - userProfile.timestamp <= USER_PROFILE_CACHE_TTL) {
            return userProfile.data;
        }

        return null;
    },

    clearUserProfileCache: () => {
        set({ userProfile: null });
        localStorage.removeItem(USER_PROFILE_CACHE_KEY);
    },

    fetchUserProfile: async (address: string, forceRefresh = false) => {
        if (!address) return null;

        try {
            console.log(`[fetchUserProfile] Fetching profile for ${address}`);

            // Check for cached profile data first
            if (!forceRefresh) {
                const cachedProfile = get().getUserProfile();
                if (cachedProfile) {
                    console.log(`[fetchUserProfile] Using cached profile data for ${address}`);
                    return cachedProfile;
                }
            }

            // Use the imported getProfile function directly
            const profileData = await getProfile(address);

            if (profileData) {
                // Type assertion to ensure safe access
                const typedProfile = profileData as { profile?: { username?: string, pfp?: string }, primaryName?: string };

                // Cache the profile data in the main user profile cache
                get().setUserProfile(profileData);

                // Importantly: also update the user profiles cache to ensure consistency
                // This ensures the primary name is available in both caching systems
                if (typedProfile.primaryName) {
                    console.log(`[fetchUserProfile] Synchronizing primary name "${typedProfile.primaryName}" to profiles cache`);
                    get().updateUserProfileCache(address, {
                        username: typedProfile.profile?.username,
                        pfp: typedProfile.profile?.pfp,
                        primaryName: typedProfile.primaryName,
                        timestamp: Date.now()
                    });
                }

                return profileData;
            }
        } catch (error) {
            console.error(`[fetchUserProfile] Error fetching profile for ${address}:`, error);
        }

        return null;
    },

    // User profiles cache - for all users
    userProfilesCache: loadUserProfilesCache(),
    getUserProfileFromCache: (userId: string) => {
        const userProfiles = get().userProfilesCache;
        if (userProfiles && userProfiles[userId]) {
            return userProfiles[userId];
        }
        return null;
    },
    updateUserProfileCache: (userId: string, profile: { username?: string, pfp?: string, primaryName?: string, timestamp: number }) => {
        const userProfiles = get().userProfilesCache;
        if (userProfiles) {
            userProfiles[userId] = profile;
            set({ userProfilesCache: userProfiles });
            saveUserProfilesCache(userProfiles);
        }
    },
    fetchUserProfileAndCache: async (userId: string, forceRefresh = false) => {
        if (!userId) return null;

        try {
            console.log(`[fetchUserProfileAndCache] Fetching profile for ${userId}`);

            // Check for cached profile data first
            if (!forceRefresh) {
                const cachedProfile = get().getUserProfileFromCache(userId);
                if (cachedProfile) {
                    console.log(`[fetchUserProfileAndCache] Using cached profile data for ${userId}`);
                    return cachedProfile;
                }
            }

            // Use the imported getProfile function directly
            const profileData = await getProfile(userId);

            if (profileData) {
                // Type assertion to ensure profile property exists
                const typedProfile = profileData as { profile?: { username?: string, pfp?: string }, primaryName?: string };

                // Cache the profile data
                get().updateUserProfileCache(userId, {
                    username: typedProfile.profile?.username,
                    pfp: typedProfile.profile?.pfp,
                    primaryName: typedProfile.primaryName,
                    timestamp: Date.now()
                });
                return profileData;
            }
        } catch (error) {
            console.error(`[fetchUserProfileAndCache] Error fetching profile for ${userId}:`, error);
        }

        return null;
    },
    clearUserProfilesCache: () => {
        set({ userProfilesCache: {} });
        localStorage.removeItem(USER_PROFILES_CACHE_KEY);
    },

    // Unread notifications
    unreadNotifications: {
        serverChannelMap: {},
        serverCounts: {},
        channelCounts: {}
    },
    setUnreadNotifications: (unread: UnreadNotificationData) => set({ unreadNotifications: unread }),
    hasUnreadNotifications: (serverId: string, channelId?: string) => {
        const { unreadNotifications } = get();
        const channelSet = unreadNotifications.serverChannelMap[serverId] || new Set();
        return channelId ? channelSet.has(channelId) : channelSet.size > 0;
    },
    getUnreadCount: (serverId: string, channelId?: string) => {
        const { unreadNotifications } = get();
        if (channelId) {
            // Return the count for a specific channel
            return unreadNotifications.channelCounts[serverId]?.[channelId] || 0;
        } else {
            // Return the count for the entire server
            return unreadNotifications.serverCounts[serverId] || 0;
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
    const { serverCache, messageCache, serverMembers } = useGlobalState();

    // Save cache to localStorage whenever it changes
    useEffect(() => {
        saveServerCache(serverCache);
    }, [serverCache]);

    // Save message cache to localStorage whenever it changes
    useEffect(() => {
        saveMessageCache(messageCache);
    }, [messageCache]);

    // Save members cache to localStorage whenever it changes
    useEffect(() => {
        saveMembersCache(serverMembers);
    }, [serverMembers]);
}

// Hook to prefetch all server data when user logs in
export function useBackgroundPreload() {
    const {
        prefetchAllServerData,
        fetchUserProfile,
        fetchUserProfileAndCache,
        fetchJoinedServers
    } = useGlobalState();
    const activeAddress = useActiveWalletAddress();

    // Track if initial load has happened
    const initialLoadCompleted = useRef(false);
    const profileLoadAttempts = useRef(0);
    const MAX_RETRY_ATTEMPTS = 3;

    useEffect(() => {
        if (activeAddress) {
            // Only log on first load or address change
            if (!initialLoadCompleted.current) {
                console.log(`[useBackgroundPreload] Initial load for address: ${activeAddress}`);
                initialLoadCompleted.current = true;
                profileLoadAttempts.current = 0;
            } else {
                console.log(`[useBackgroundPreload] Address changed to: ${activeAddress}`);
                profileLoadAttempts.current = 0;
            }

            // Critical data loading function with retries
            const loadCriticalData = async () => {
                try {
                    console.log(`[useBackgroundPreload] Loading critical user data for ${activeAddress}`);

                    // Step 1: Fetch user profile with retry logic
                    let profileData = null;
                    try {
                        console.log(`[useBackgroundPreload] Fetching user profile for ${activeAddress}`);
                        profileData = await fetchUserProfile(activeAddress, true);
                        if (profileData) {
                            console.log(`[useBackgroundPreload] Successfully loaded user profile`);
                        } else {
                            throw new Error("Profile data is null");
                        }
                    } catch (err) {
                        console.warn(`[useBackgroundPreload] Profile fetch attempt ${profileLoadAttempts.current + 1} failed:`, err);

                        // Attempt to retry profile fetch if needed
                        if (profileLoadAttempts.current < MAX_RETRY_ATTEMPTS) {
                            profileLoadAttempts.current++;
                            console.log(`[useBackgroundPreload] Retrying profile fetch (attempt ${profileLoadAttempts.current})`);

                            // Retry after a short delay
                            setTimeout(() => {
                                loadCriticalData();
                            }, 1500);
                            return;
                        }
                    }

                    // Step 2: Ensure the user's primary name is cached in their profile
                    // (This happens as part of fetchUserProfile, but we ensure it's there)
                    if (profileData && !profileData.primaryName) {
                        console.log(`[useBackgroundPreload] Ensuring user primary name is fetched`);
                        await fetchUserProfileAndCache(activeAddress, true);
                    }

                    // Step 3: Load joined servers list
                    try {
                        console.log(`[useBackgroundPreload] Fetching user's joined servers`);
                        const serverIds = await fetchJoinedServers(activeAddress, true);
                        console.log(`[useBackgroundPreload] Loaded ${serverIds.length} joined servers`);
                    } catch (err) {
                        console.warn('[useBackgroundPreload] Failed to fetch joined servers:', err);
                    }

                    // Step 4: Start background prefetch of all server data
                    // This includes server info and members with lower priority
                    console.log(`[useBackgroundPreload] Starting background server data prefetch`);
                    setTimeout(() => {
                        prefetchAllServerData(activeAddress);
                    }, 500);

                } catch (err) {
                    console.error('[useBackgroundPreload] Critical data loading failed:', err);
                }
            };

            // Execute critical data loading immediately
            loadCriticalData();
        }
    }, [activeAddress, prefetchAllServerData, fetchUserProfile, fetchUserProfileAndCache, fetchJoinedServers]);

    return null;
}

// Helper to get the active wallet address
function useActiveWalletAddress() {
    const [address, setAddress] = useState<string | null>(null);

    useEffect(() => {
        async function getAddress() {
            try {
                if (window.arweaveWallet) {
                    const addr = await window.arweaveWallet.getActiveAddress();
                    setAddress(addr);
                }
            } catch (error) {
                console.error("Error getting wallet address:", error);
            }
        }

        getAddress();
    }, []);

    return address;
}

