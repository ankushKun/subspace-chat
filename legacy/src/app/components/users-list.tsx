import { useGlobalState } from "@/hooks/global-state";
import { useMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserIcon, Loader2, ShieldIcon, AlertCircle, RefreshCcw } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import type { Member } from "@/lib/types";
import { useWallet } from '@/hooks/use-wallet';
import { Skeleton } from "@/components/ui/skeleton";
import UserProfilePopover from "./user-profile-popover";
import { PopoverTrigger } from "@/components/ui/popover";
import { fetchBulkProfiles, subscribeToProfileChanges } from "@/lib/profile-manager";

// Global request tracking to persist across component remounts
const globalRequestLimiter = {
    serverRequests: new Map<string, number>(),
    lastAttemptTimes: new Map<string, number>(),
    MIN_REQUEST_INTERVAL: 60000, // 1 minute minimum between requests
    MAX_REQUESTS_PER_SERVER: 3,
    isServerBlocked: function (serverId: string): boolean {
        const count = this.serverRequests.get(serverId) || 0;
        const lastAttempt = this.lastAttemptTimes.get(serverId) || 0;
        const now = Date.now();

        // Block if:
        // 1. We've exceeded max requests
        // 2. We've tried too recently
        return count >= this.MAX_REQUESTS_PER_SERVER ||
            (now - lastAttempt < this.MIN_REQUEST_INTERVAL);
    },
    recordAttempt: function (serverId: string) {
        const count = this.serverRequests.get(serverId) || 0;
        this.serverRequests.set(serverId, count + 1);
        this.lastAttemptTimes.set(serverId, Date.now());
    }
};

// Add a new cooldown tracker for force refreshes
const forceRefreshCooldowns = new Map<string, number>();
const FORCE_REFRESH_COOLDOWN = 30000; // 30 seconds between force refreshes

// Helper to check if we can force refresh
function canForceRefresh(serverId: string): boolean {
    const lastRefresh = forceRefreshCooldowns.get(serverId);
    const now = Date.now();
    return !lastRefresh || (now - lastRefresh) > FORCE_REFRESH_COOLDOWN;
}

// Helper to record a force refresh
function recordForceRefresh(serverId: string) {
    forceRefreshCooldowns.set(serverId, Date.now());
}

// Define response type for getMembers
interface MembersResponse {
    success: boolean;
    members: Member[];
}

export default function UsersList() {
    const {
        activeServerId,
        activeServer,
        showUsers,
        setShowUsers,
        getServerMembers,
        fetchServerMembers,
        userProfilesCache,
        getUserProfileFromCache
    } = useGlobalState();
    const [error, setError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
    const isMobile = useMobile();
    const { address: activeAddress } = useWallet();
    const abortControllerRef = useRef<AbortController | null>(null);
    const hasLoadedProfilesRef = useRef(false);
    const processedMembersRef = useRef<string>('');
    const lastFetchAttemptRef = useRef<number>(0);
    const fetchFailedRef = useRef<boolean>(false);
    const firstRenderRef = useRef(true);

    // Create a cache version state to force re-renders when profile cache changes
    const [cacheVersion, setCacheVersion] = useState(0);

    // Get members from global state
    const members = activeServerId ? getServerMembers(activeServerId) : null;

    // Subscribe to profile change events from ProfileManager
    useEffect(() => {
        // When a profile changes, increment cache version to trigger re-render
        const unsubscribe = subscribeToProfileChanges((userId) => {
            // Check if this user is one of our members
            if (members && members.some(m => m.id === userId)) {
                setCacheVersion(v => v + 1);
            }
        });

        return () => unsubscribe();
    }, [members]);

    // Reset state when server changes
    useEffect(() => {
        // Reset error state when server changes
        setError(null);
        setIsRetrying(false);

        // This ensures a clean slate for each server
        hasLoadedProfilesRef.current = false;
        processedMembersRef.current = '';
        fetchFailedRef.current = false;

        console.log('[UsersList] Reset state for new server:', activeServerId);
    }, [activeServerId]);

    // This function loads profiles for all members efficiently using ProfileManager
    const loadMembersProfiles = useCallback(async (membersList: Member[]) => {
        if (!membersList || membersList.length === 0) return;

        // Avoid multiple concurrent loading operations
        if (isLoadingProfiles) {
            console.log(`[UsersList] Profile loading already in progress, skipping`);
            return;
        }

        setIsLoadingProfiles(true);

        try {
            console.log(`[UsersList] Loading profiles for ${membersList.length} members`);

            // Extract unique member IDs for bulk loading
            const memberIds = membersList.map(member => member.id);

            // Use the ProfileManager's bulk fetch method
            await fetchBulkProfiles(memberIds);

            // Increment cache version to trigger re-render with new data
            setCacheVersion(v => v + 1);

            console.log(`[UsersList] Successfully loaded member profiles`);
        } catch (error) {
            console.error('[UsersList] Error loading member profiles:', error);
        } finally {
            setIsLoadingProfiles(false);
        }
    }, [isLoadingProfiles]);

    // Handle loading members
    useEffect(() => {
        if (!activeServerId || !showUsers) return;

        const loadMembers = async () => {
            try {
                // Check if we have cached members first
                const currentMembers = getServerMembers(activeServerId);
                const now = Date.now();
                const shouldForceRefresh = canForceRefresh(activeServerId);

                if (!currentMembers || currentMembers.length === 0) {
                    // No cached data, do a force refresh
                    await fetchServerMembers(activeServerId, true);
                    recordForceRefresh(activeServerId);
                } else if (shouldForceRefresh) {
                    // We have cached data but it might be stale, refresh in background
                    console.log(`[UsersList] Background refreshing members for ${activeServerId}`);
                    fetchServerMembers(activeServerId, true)
                        .then(() => recordForceRefresh(activeServerId))
                        .catch(error => console.warn('[UsersList] Background refresh failed:', error));
                }

                // Load profiles for members if available
                const members = getServerMembers(activeServerId);
                if (members && members.length > 0) {
                    await loadMembersProfiles(members);
                    hasLoadedProfilesRef.current = true;
                }
            } catch (error) {
                console.error('[UsersList] Error loading members data:', error);
                fetchFailedRef.current = true;
            }
        };

        loadMembers();
    }, [activeServerId, showUsers, getServerMembers, fetchServerMembers, loadMembersProfiles]);

    // Get display name for a member with better profile data handling
    const getDisplayName = (member: Member) => {
        // Prioritize server nickname if available
        if (member.nickname) {
            return member.nickname;
        }

        // Get the latest profile data from cache
        const profileData = getUserProfileFromCache(member.id);

        // Use primaryName or username if available
        if (profileData?.primaryName) {
            return profileData.primaryName;
        }

        if (profileData?.username) {
            return profileData.username;
        }

        // Fall back to truncated ID
        return member.id.substring(0, 6) + '...' + member.id.substring(member.id.length - 4);
    };

    // Get profile picture for a user
    const getProfilePicture = (memberId: string) => {
        // Check profile cache from global state
        const profileData = getUserProfileFromCache(memberId);
        return profileData?.pfp;
    };

    // Check if member is the server owner
    const isServerOwner = (memberId: string) => {
        return activeServer?.owner === memberId;
    };

    // Check if this is the current user
    const isCurrentUser = (memberId: string) => {
        return activeAddress === memberId;
    };

    // Generate placeholder members when real data is loading
    const generatePlaceholderMembers = () => {
        // Create array based on member_count or default to 5 items
        const count = activeServer?.member_count || 5;
        const limitedCount = Math.min(count, 10); // Limit to maximum 10 placeholders

        return Array.from({ length: limitedCount }).map((_, index) => (
            <div key={`placeholder-${index}`} className="flex items-center gap-3 p-2">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-16 h-3" />
                </div>
            </div>
        ));
    };

    // Display appropriate member count based on available data
    const getMemberCountDisplay = () => {
        if (Array.isArray(members)) {
            return `(${members.length})`;
        } else if (activeServer?.member_count) {
            return `(${activeServer.member_count})`;
        }
        return '';
    };

    // We no longer need error checking since all servers now support member listing
    return (
        <div className="h-full w-full flex flex-col">
            {/* Users Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border/30 h-14">
                {isMobile && <Button variant="ghost" size="icon" className="!p-0 -ml-1" onClick={() => setShowUsers(false)}>
                    <ArrowLeft size={20} className="!h-5 !w-5 text-muted-foreground" />
                </Button>}
                <span className="font-medium">Members {getMemberCountDisplay()}</span>
            </div>

            {/* Users List Area */}
            <div className="flex-1 overflow-y-auto px-0 py-4">
                {!members || members.length === 0 ? (
                    // Show placeholders when members is null (still loading) or empty
                    <div className="space-y-1">
                        {generatePlaceholderMembers()}
                    </div>
                ) : (
                    // We have members to display - show the list
                    <div className="space-y-1">
                        {members.map((member) => (
                            <UserProfilePopover
                                key={member.id}
                                userId={member.id}
                                side="right"
                                align="start"
                            >
                                <PopoverTrigger asChild>
                                    <div
                                        className="flex items-center gap-2 p-2 hover:bg-accent rounded-md transition-colors cursor-pointer"
                                    >
                                        <div className="h-8 w-8 mx-2 mr-4 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary">
                                            {getProfilePicture(member.id) ? (
                                                <img
                                                    src={`https://arweave.net/${getProfilePicture(member.id)}`}
                                                    alt={getDisplayName(member)}
                                                    className="object-cover w-full h-full"
                                                    onError={(e) => {
                                                        // Handle broken images
                                                        e.currentTarget.src = '';
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.parentElement!.innerHTML = getDisplayName(member).charAt(0).toUpperCase();
                                                    }}
                                                />
                                            ) : (
                                                getDisplayName(member).charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium text-sm truncate`}>
                                                    {getDisplayName(member)}
                                                </span>
                                                {isServerOwner(member.id) && (
                                                    <ShieldIcon className="h-3.5 w-3.5 text-amber-500" />
                                                )}
                                                {isCurrentUser(member.id) && (
                                                    <span className="text-xs text-muted-foreground">(you)</span>
                                                )}
                                            </div>

                                            {/* Show primary name as additional info if both username and primaryName exist */}
                                            {getUserProfileFromCache(member.id)?.username &&
                                                getUserProfileFromCache(member.id)?.primaryName && (
                                                    <span className="text-xs text-muted-foreground block">
                                                        {getUserProfileFromCache(member.id)?.primaryName}
                                                    </span>
                                                )}

                                            <span className="text-xs text-muted-foreground truncate">
                                                {member.id.substring(0, 6)}...{member.id.substring(member.id.length - 4)}
                                            </span>
                                        </div>
                                    </div>
                                </PopoverTrigger>
                            </UserProfilePopover>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}