import { createLogger } from './logger';
import { aofetch } from "ao-fetch";
import { ARIO } from "@ar.io/sdk";
import { useGlobalState } from "@/hooks/global-state";
import { useWallet } from "@/hooks/use-wallet";

// Initialize AR.IO client for primary name lookup
const ario = ARIO.mainnet();

// Create a logger for this module
const logger = createLogger('profile-manager');

// AO Profiles process ID
const PROFILES = "J-GI_SARbZ8O0km4JiE2lu2KJdZIWMo53X3HrqusXjY";

export interface UserProfile {
    id: string;           // Wallet address
    username?: string;    // User-set display name
    pfp?: string;         // Profile picture AR transaction ID
    primaryName?: string; // AR.IO primary name
    timestamp: number;    // When this profile was cached
}

/**
 * A singleton class to manage user profile data across the application
 * Provides caching, request deduplication, and centralized profile management
 */
class ProfileManager {
    // Cache for profile data
    private profileCache: Map<string, UserProfile> = new Map();

    // Track in-flight requests to prevent duplicates
    private pendingRequests: Map<string, Promise<any>> = new Map();

    // Track request timing for rate limiting
    private lastRequestTimes: Map<string, number> = new Map();

    // Batch request queue
    private batchQueue: Set<string> = new Set();
    private batchProcessTimeout: NodeJS.Timeout | null = null;

    // Event handlers for subscribers
    private profileChangeListeners: Set<(userId: string) => void> = new Set();

    // Configuration
    private MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests for the same profile
    private CACHE_TTL = 15 * 60 * 1000;  // 15 minute cache lifetime
    private BATCH_DELAY = 50;            // 50ms delay before processing batch
    private BATCH_SIZE = 20;             // Maximum profiles to fetch in one batch

    constructor() {
        // Load cached profiles from local storage
        this.loadCachedProfiles();

        // Set up interval to periodically save cache to localStorage
        setInterval(() => this.saveCachedProfiles(), 60000);

        logger.info('ProfileManager initialized');
    }

    /**
     * Load cached profiles from localStorage
     */
    private loadCachedProfiles(): void {
        try {
            const cached = localStorage.getItem('user-profiles-cache');
            if (cached) {
                const parsedData = JSON.parse(cached);

                // Validate and process the data
                if (parsedData && typeof parsedData === 'object') {
                    Object.entries(parsedData).forEach(([userId, profile]) => {
                        if (profile && typeof profile === 'object' && 'timestamp' in profile) {
                            // Only load profiles that aren't too old
                            if (Date.now() - (profile as UserProfile).timestamp < this.CACHE_TTL) {
                                this.profileCache.set(userId, profile as UserProfile);
                            }
                        }
                    });
                }

                logger.info(`Loaded ${this.profileCache.size} profiles from cache`);
            }
        } catch (error) {
            logger.warn('Error loading cached profiles:', error);
        }
    }

    /**
     * Save cached profiles to localStorage
     */
    private saveCachedProfiles(): void {
        try {
            // Convert Map to object for serialization
            const profilesObj: Record<string, UserProfile> = {};

            // Only keep profiles that aren't too old
            this.profileCache.forEach((profile, userId) => {
                if (Date.now() - profile.timestamp < this.CACHE_TTL) {
                    profilesObj[userId] = profile;
                }
            });

            localStorage.setItem('user-profiles-cache', JSON.stringify(profilesObj));
            logger.info(`Saved ${Object.keys(profilesObj).length} profiles to cache`);
        } catch (error) {
            logger.warn('Error saving cached profiles:', error);
        }
    }

    /**
     * Get a profile from cache if available and not expired
     */
    private getCachedProfile(userId: string): UserProfile | null {
        const profile = this.profileCache.get(userId);

        if (profile && Date.now() - profile.timestamp < this.CACHE_TTL) {
            return profile;
        }

        return null;
    }

    /**
     * Should we throttle requests for this user ID?
     */
    private shouldThrottle(userId: string): boolean {
        const lastRequest = this.lastRequestTimes.get(userId) || 0;
        return Date.now() - lastRequest < this.MIN_REQUEST_INTERVAL;
    }

    /**
     * Record a fetch attempt to apply rate limiting
     */
    private recordRequestAttempt(userId: string): void {
        this.lastRequestTimes.set(userId, Date.now());
    }

    /**
     * Update the profile cache with new data
     */
    public updateProfile(userId: string, data: Partial<UserProfile>): void {
        const existing = this.profileCache.get(userId) || {
            id: userId,
            timestamp: Date.now()
        };

        const updated = {
            ...existing,
            ...data,
            id: userId,
            timestamp: Date.now()
        };

        this.profileCache.set(userId, updated);

        // Notify listeners of profile change
        this.notifyProfileChanged(userId);

        // Also update the global state cache for compatibility
        try {
            const globalState = useGlobalState.getState();
            globalState.updateUserProfileCache(userId, updated);
        } catch (error) {
            logger.warn('Error updating global state cache:', error);
        }
    }

    /**
     * Get a user profile - returns cached data or fetches if needed
     * @param userId User wallet address
     * @param forceRefresh Force a refresh even if cached data exists
     */
    public async getProfile(userId: string, forceRefresh = false): Promise<UserProfile> {
        // Check cache first
        if (!forceRefresh) {
            const cached = this.getCachedProfile(userId);
            if (cached) {
                logger.info(`Using cached profile for ${userId}`);
                return cached;
            }
        }

        // Check if we need to throttle
        if (this.shouldThrottle(userId) && !forceRefresh) {
            logger.info(`Request throttled for ${userId}`);

            // Use expired cache as fallback
            const expired = this.profileCache.get(userId);
            if (expired) {
                return expired;
            }

            // If we have no cached data at all, bypass throttling for first-time loads
            logger.info(`No cached data for ${userId}, bypassing throttle for first load`);
        }

        // Record this attempt for rate limiting
        this.recordRequestAttempt(userId);

        // Deduplicate in-flight requests
        if (this.pendingRequests.has(userId)) {
            logger.info(`Reusing pending request for ${userId}`);
            return this.pendingRequests.get(userId)!;
        }

        // Create and store the promise
        const promise = this.fetchProfileFromAO(userId).finally(() => {
            this.pendingRequests.delete(userId);
        });

        this.pendingRequests.set(userId, promise);
        return promise;
    }

    /**
     * Actual implementation of profile fetching from AO
     */
    private async fetchProfileFromAO(userId: string): Promise<UserProfile> {
        try {
            logger.info(`Fetching profile for ${userId}`);

            // Make the API request
            const res = await aofetch(`${PROFILES}/profile`, {
                method: "GET",
                body: { id: userId }
            });

            if (res.status !== 200) {
                throw new Error(res.error || `HTTP status ${res.status}`);
            }

            // Extract profile data
            const profileData = res.json as Record<string, any>;

            // Create base profile
            const profile: UserProfile = {
                id: profileData.profile?.original_id || userId,
                username: profileData.profile?.username,
                pfp: profileData.profile?.pfp,
                timestamp: Date.now()
            };

            // Try to get primary name
            try {
                const primaryNameData = await ario.getPrimaryName({ address: userId });
                if (primaryNameData && primaryNameData.name) {
                    profile.primaryName = primaryNameData.name;
                    logger.info(`Found primary name for ${userId}: ${primaryNameData.name}`);
                }
            } catch (error) {
                logger.warn(`Failed to get primary name for ${userId}:`, error);
            }

            // Cache the profile
            this.updateProfile(userId, profile);

            return profile;
        } catch (error) {
            logger.error(`Error fetching profile for ${userId}:`, error);

            // Create a minimal profile with error flag
            const errorProfile: UserProfile = {
                id: userId,
                timestamp: Date.now()
            };

            // Still cache this minimal profile to prevent repeated failed requests
            this.profileCache.set(userId, errorProfile);

            return errorProfile;
        }
    }

    /**
     * Queue a profile for batch fetching
     */
    public queueProfileFetch(userId: string): void {
        // Don't queue if already cached and fresh
        if (this.getCachedProfile(userId)) {
            return;
        }

        // Add to queue
        this.batchQueue.add(userId);

        // Set up batch processing if not already scheduled
        if (!this.batchProcessTimeout) {
            this.batchProcessTimeout = setTimeout(() => {
                this.processBatchQueue();
            }, this.BATCH_DELAY);
        }
    }

    /**
     * Process the batch queue
     */
    private async processBatchQueue(): Promise<void> {
        // Clear the timeout reference
        this.batchProcessTimeout = null;

        // If queue is empty, do nothing
        if (this.batchQueue.size === 0) {
            return;
        }

        // Get IDs from queue (max batch size)
        const userIds = Array.from(this.batchQueue).slice(0, this.BATCH_SIZE);

        // Clear processed IDs from queue
        userIds.forEach(id => this.batchQueue.delete(id));

        // If there are more IDs left in the queue, schedule another process
        if (this.batchQueue.size > 0) {
            this.batchProcessTimeout = setTimeout(() => {
                this.processBatchQueue();
            }, this.BATCH_DELAY);
        }

        // Process this batch
        await this.fetchBulkProfiles(userIds);
    }

    /**
     * Fetch multiple profiles in one request
     */
    public async fetchBulkProfiles(userIds: string[]): Promise<UserProfile[]> {
        if (!userIds || userIds.length === 0) {
            return [];
        }

        // Remove duplicates
        const uniqueIds = [...new Set(userIds)];

        // Skip already cached and fresh profiles
        const idsToFetch = uniqueIds.filter(id => {
            const cached = this.getCachedProfile(id);
            return !cached;
        });

        if (idsToFetch.length === 0) {
            // Return cached profiles
            return uniqueIds.map(id => this.getCachedProfile(id)!);
        }

        try {
            logger.info(`Bulk fetching ${idsToFetch.length} profiles`);

            // Make the API request
            const res = await aofetch(`${PROFILES}/bulk-profile`, {
                method: "GET",
                body: {
                    ids: JSON.stringify(idsToFetch)
                }
            });

            if (res.status !== 200) {
                throw new Error(res.error || `HTTP status ${res.status}`);
            }

            const response = res.json as { success: boolean, profiles: any[] };

            if (!response.success || !Array.isArray(response.profiles)) {
                throw new Error('Invalid response format');
            }

            // Process and cache each profile
            const profiles: UserProfile[] = [];

            for (const profileData of response.profiles) {
                if (!profileData.id) continue;

                const profile: UserProfile = {
                    id: profileData.id,
                    username: profileData.username,
                    pfp: profileData.pfp,
                    timestamp: Date.now()
                };

                // Cache profile immediately
                this.updateProfile(profileData.id, profile);
                profiles.push(profile);
            }

            // Fetch primary names in background for newly fetched profiles
            this.fetchPrimaryNamesInBackground(profiles.map(p => p.id));

            logger.info(`Successfully cached ${profiles.length} profiles`);

            // Return all profiles (including ones that were already cached)
            return uniqueIds.map(id => this.getCachedProfile(id)!);
        } catch (error) {
            logger.error(`Error bulk fetching profiles:`, error);

            // Create minimal profiles for the IDs we failed to fetch
            idsToFetch.forEach(id => {
                this.profileCache.set(id, {
                    id,
                    timestamp: Date.now()
                });
            });

            // Return whatever we have in cache
            return uniqueIds.map(id => this.getCachedProfile(id) || {
                id,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Fetch primary names in background for multiple profiles
     */
    private async fetchPrimaryNamesInBackground(userIds: string[]): Promise<void> {
        if (!userIds || userIds.length === 0) return;

        // Process primary names in small batches
        const BATCH_SIZE = 5;

        for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
            const batch = userIds.slice(i, i + BATCH_SIZE);

            // Process each ID in the batch
            await Promise.allSettled(batch.map(async (userId) => {
                try {
                    // Skip if we already have primary name
                    const existing = this.getCachedProfile(userId);
                    if (existing?.primaryName) return;

                    // Fetch primary name from AR.IO
                    const primaryNameData = await ario.getPrimaryName({ address: userId });

                    if (primaryNameData && primaryNameData.name) {
                        // Update just the primary name
                        this.updateProfile(userId, {
                            primaryName: primaryNameData.name
                        });
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch primary name for ${userId}:`, error);
                }
            }));

            // Small delay between batches
            if (i + BATCH_SIZE < userIds.length) {
                await new Promise<void>(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * Subscribe to profile changes
     * @returns Unsubscribe function
     */
    public subscribeToProfileChanges(callback: (userId: string) => void): () => void {
        this.profileChangeListeners.add(callback);

        // Return unsubscribe function
        return () => {
            this.profileChangeListeners.delete(callback);
        };
    }

    /**
     * Notify listeners of profile changes
     */
    private notifyProfileChanged(userId: string): void {
        this.profileChangeListeners.forEach(listener => {
            try {
                listener(userId);
            } catch (error) {
                logger.warn('Error in profile change listener:', error);
            }
        });
    }

    /**
     * Get all profile IDs in the cache
     */
    public getCachedProfileIds(): string[] {
        return Array.from(this.profileCache.keys());
    }

    /**
     * Clear expired profiles from cache
     */
    public clearExpiredProfiles(): void {
        const now = Date.now();
        let removedCount = 0;

        this.profileCache.forEach((profile, userId) => {
            if (now - profile.timestamp > this.CACHE_TTL) {
                this.profileCache.delete(userId);
                removedCount++;
            }
        });

        if (removedCount > 0) {
            logger.info(`Cleared ${removedCount} expired profiles from cache`);
            this.saveCachedProfiles();
        }
    }

    /**
     * Warm up the cache with provided user IDs
     * This pre-loads profiles without waiting for them
     */
    public warmupCache(userIds: string[]): void {
        if (!userIds || userIds.length === 0) return;

        // Queue each ID for batch processing
        userIds.forEach(userId => {
            this.queueProfileFetch(userId);
        });
    }
}

// Create singleton instance
const profileManager = new ProfileManager();

// Clean up expired profiles periodically
setInterval(() => profileManager.clearExpiredProfiles(), 5 * 60 * 1000);

// Export convenient methods that use the singleton
export const getProfile = (userId: string, forceRefresh = false) =>
    profileManager.getProfile(userId, forceRefresh);

export const fetchBulkProfiles = (userIds: string[]) =>
    profileManager.fetchBulkProfiles(userIds);

export const updateProfile = (userId: string, data: Partial<UserProfile>) =>
    profileManager.updateProfile(userId, data);

export const subscribeToProfileChanges = (callback: (userId: string) => void) =>
    profileManager.subscribeToProfileChanges(callback);

export const warmupProfileCache = (userIds: string[]) =>
    profileManager.warmupCache(userIds);

export default profileManager; 