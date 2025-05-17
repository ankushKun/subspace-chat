/**
 * This is an adapter/compatibility layer between the old global state based profile
 * management and the new ProfileManager. It helps transition to the new system without
 * requiring all components to change at once.
 */

import {
    getProfile,
    fetchBulkProfiles,
    updateProfile,
    subscribeToProfileChanges,
    warmupProfileCache,
} from './profile-manager';
import type { UserProfile } from './profile-manager';
import { useGlobalState } from '@/hooks/global-state';
import { createLogger } from './logger';

const logger = createLogger('profile-adapter');

/**
 * A compatibility layer between the old fetchUserProfileAndCache method
 * and the new ProfileManager.
 */
export async function fetchUserProfileAndCache(userId: string, forceRefresh = false): Promise<any> {
    try {
        // Use the new ProfileManager
        const profile = await getProfile(userId, forceRefresh);

        // Also ensure it's in the global state
        if (profile) {
            const globalState = useGlobalState.getState();
            globalState.updateUserProfileCache(userId, {
                username: profile.username,
                pfp: profile.pfp,
                primaryName: profile.primaryName,
                timestamp: profile.timestamp
            });
        }

        // Return in the format expected by old code
        return profile ? {
            profile: {
                username: profile.username,
                pfp: profile.pfp
            },
            primaryName: profile.primaryName
        } : null;
    } catch (error) {
        logger.error(`[fetchUserProfileAndCache] Error fetching profile for ${userId}:`, error);
        return null;
    }
}

/**
 * A compatibility layer between the old fetchBulkUserProfilesAndCache method
 * and the new ProfileManager.
 */
export async function fetchBulkUserProfilesAndCache(userIds: string[], forceRefresh = false): Promise<any[]> {
    try {
        // Use the new ProfileManager's bulk fetch
        const profiles = await fetchBulkProfiles(userIds);

        // Convert to format expected by older code
        return profiles.map(profile => ({
            id: profile.id,
            username: profile.username,
            pfp: profile.pfp,
            primaryName: profile.primaryName
        }));
    } catch (error) {
        logger.error(`[fetchBulkUserProfilesAndCache] Error bulk fetching profiles:`, error);
        return [];
    }
}

/**
 * A compatibility function that syncs any changes in the ProfileManager
 * with the global state's profile cache.
 */
export function setupProfileCacheSync(): () => void {
    return subscribeToProfileChanges((userId) => {
        try {
            // Get the profile from our ProfileManager
            getProfile(userId).then(profile => {
                if (!profile) return;

                // Update the global state
                const globalState = useGlobalState.getState();
                globalState.updateUserProfileCache(userId, {
                    username: profile.username,
                    pfp: profile.pfp,
                    primaryName: profile.primaryName,
                    timestamp: profile.timestamp
                });
            });
        } catch (error) {
            logger.warn(`Error syncing profile changes for ${userId}:`, error);
        }
    });
}

// Initialize profile sync when this module is loaded
const unsubscribeSyncFn = setupProfileCacheSync();

// Clean up on hot reload during development
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        unsubscribeSyncFn();
    });
}

export {
    getProfile,
    fetchBulkProfiles,
    updateProfile,
    subscribeToProfileChanges,
    warmupProfileCache,
};

export type { UserProfile }; 