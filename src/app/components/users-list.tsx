import { useGlobalState } from "@/hooks/global-state";
import { useMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserIcon, Loader2, ShieldIcon, AlertCircle, RefreshCcw } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { getProfile } from "@/lib/ao";
import type { Member } from "@/lib/types";
import { useActiveAddress } from "@arweave-wallet-kit/react";
import { Skeleton } from "@/components/ui/skeleton";
import UserProfilePopover from "./user-profile-popover";
import { PopoverTrigger } from "@/components/ui/popover";

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
        invalidMemberServers,
        getUserProfile,
        // Use the centralized profile cache
        userProfilesCache,
        getUserProfileFromCache,
        updateUserProfileCache,
        fetchUserProfileAndCache
    } = useGlobalState();
    const [error, setError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
    const isMobile = useMobile();
    const activeAddress = useActiveAddress();
    const abortControllerRef = useRef<AbortController | null>(null);
    const hasLoadedProfilesRef = useRef(false);
    const processedMembersRef = useRef<string>('');
    const lastFetchAttemptRef = useRef<number>(0);
    const fetchFailedRef = useRef<boolean>(false);
    const firstRenderRef = useRef(true);
    const serverRequestsRef = useRef<Map<string, number>>(new Map());
    const MAX_REQUESTS_PER_SERVER = 3; // Maximum number of fetch attempts per server per session

    // Get members from global state
    const members = activeServerId ? getServerMembers(activeServerId) : null;

    // Check if we've exceeded fetch attempts for this server
    const checkServerRequestLimit = (serverId: string): boolean => {
        if (!serverId) return false;

        const currentCount = serverRequestsRef.current.get(serverId) || 0;
        if (currentCount >= MAX_REQUESTS_PER_SERVER) {
            console.log(`[UsersList] Server ${serverId} has reached the maximum request limit (${MAX_REQUESTS_PER_SERVER})`);
            return true;
        }

        // Increment the counter
        serverRequestsRef.current.set(serverId, currentCount + 1);
        return false;
    };

    // This function loads profiles for all members in batches
    const loadMembersProfiles = useCallback(async (membersList: Member[]) => {
        if (!membersList || membersList.length === 0) return;

        // Avoid multiple concurrent loading operations
        if (isLoadingProfiles) {
            console.log(`[UsersList] Profile loading already in progress, skipping`);
            return;
        }

        setIsLoadingProfiles(true);

        // Create a new abort controller
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            console.log(`[UsersList] Loading profiles for ${membersList.length} members`);

            // Identify which members need profile loading
            const membersToLoad = membersList.filter(member => {
                const cachedProfile = getUserProfileFromCache(member.id);
                // Skip if we have fresh cache (less than 15 minutes old)
                return !(cachedProfile &&
                    Date.now() - cachedProfile.timestamp < 15 * 60 * 1000);
            });

            if (membersToLoad.length === 0) {
                console.log(`[UsersList] All member profiles already in cache`);
                setIsLoadingProfiles(false);
                return;
            }

            console.log(`[UsersList] Need to load ${membersToLoad.length} member profiles`);

            // Track loaded profiles to avoid repeated requests
            const loadedIds = new Set<string>();

            // Process members in batches to avoid rate limiting
            for (let i = 0; i < membersToLoad.length; i++) {
                // Break if component unmounted or fetch aborted
                if (signal.aborted) break;

                const member = membersToLoad[i];

                // Skip if already processed in this batch
                if (loadedIds.has(member.id)) continue;
                loadedIds.add(member.id);

                // Prioritize loading the current user's profile from global state
                if (member.id === activeAddress) {
                    const currentUserProfile = getUserProfile();
                    if (currentUserProfile && currentUserProfile.profile) {
                        updateUserProfileCache(member.id, {
                            username: currentUserProfile.profile.username,
                            pfp: currentUserProfile.profile.pfp,
                            primaryName: currentUserProfile.primaryName,
                            timestamp: Date.now()
                        });
                        continue;
                    }
                }

                // Load profile for this member
                await fetchUserProfileAndCache(member.id, false);

                // Add a delay between requests to prevent rate limiting
                if (!signal.aborted && i < membersToLoad.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } catch (error) {
            console.error('[UsersList] Error loading member profiles:', error);
        } finally {
            if (!signal.aborted) {
                setIsLoadingProfiles(false);
            }
        }
    }, [
        isLoadingProfiles,
        setIsLoadingProfiles,
        getUserProfileFromCache,
        activeAddress,
        getUserProfile,
        updateUserProfileCache,
        fetchUserProfileAndCache
    ]);

    // Setup on first render
    useEffect(() => {
        // Reset on component unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            // Clear tracked requests on unmount
            serverRequestsRef.current.clear();
        };
    }, []);

    // Fix the useEffect that triggers profile loading when panel becomes visible
    useEffect(() => {
        // Only trigger a fetch when the panel is shown and we have an active server
        if (showUsers && activeServerId) {
            const now = Date.now();
            const timeSinceLastFetch = now - lastFetchAttemptRef.current;
            const minFetchInterval = 60000; // Increase to 60 seconds to be more conservative

            // Skip under these conditions:
            // 1. We're in first render - let the app stabilize
            if (firstRenderRef.current) {
                firstRenderRef.current = false;
                return;
            }

            // 2. Previous fetch failed and hasn't been manually retried
            if (fetchFailedRef.current) {
                console.log(`[UsersList] Previous fetch failed, waiting for user retry`);
                return;
            }

            // 3. We've tried too recently
            if (timeSinceLastFetch < minFetchInterval) {
                console.log(`[UsersList] Skipping fetch, last attempt was ${timeSinceLastFetch}ms ago`);
                return;
            }

            // 4. We've already loaded members for this server
            if (hasLoadedProfilesRef.current && members && members.length > 0) {
                console.log(`[UsersList] Already loaded ${members.length} members, using existing data`);
                return;
            }

            // 5. We've made too many requests to this server
            if (checkServerRequestLimit(activeServerId)) {
                fetchFailedRef.current = true; // Mark as failed to prevent future automatic attempts
                return;
            }

            console.log(`[UsersList] Panel visible, fetching members for ${activeServerId}`);
            lastFetchAttemptRef.current = now;

            // Get a reference to the global state
            const globalState = useGlobalState.getState();

            // Background refresh members with slight delay to allow UI to render first
            const timerId = setTimeout(() => {
                // Do one more check to make sure the component is still mounted
                if (abortControllerRef.current === null) return;

                globalState.fetchServerMembers(activeServerId, true)
                    .then(() => {
                        // Only try to load profiles if we actually got members
                        const currentMembers = globalState.getServerMembers(activeServerId);
                        if (currentMembers && currentMembers.length > 0) {
                            loadMembersProfiles(currentMembers);
                        }
                        // Mark as loaded regardless of result to prevent repeated attempts
                        hasLoadedProfilesRef.current = true;
                        fetchFailedRef.current = false;
                    })
                    .catch(error => {
                        console.warn("[UsersList] Failed to refresh members data:", error);
                        // Mark as failed to prevent automatic retries
                        fetchFailedRef.current = true;
                        // Mark as loaded to prevent spam
                        hasLoadedProfilesRef.current = true;
                    });
            }, 300);

            // Clean up the timer if the component unmounts
            return () => clearTimeout(timerId);
        }
    }, [showUsers, activeServerId, members, loadMembersProfiles]);

    // Add a separate effect to monitor for member changes - with safety checks
    useEffect(() => {
        // Only run this if we have members and the panel is visible
        if (showUsers && members && members.length > 0 && !isLoadingProfiles) {
            // Create a fingerprint of the current member list
            const memberIds = members.map(m => m.id).join(',');

            // Only process if this is a new set of members we haven't seen before
            if (processedMembersRef.current !== memberIds) {
                const now = Date.now();
                const timeSinceLastFetch = now - lastFetchAttemptRef.current;
                const minFetchInterval = 30000; // Increase to 30 seconds between profile loads

                if (timeSinceLastFetch < minFetchInterval) {
                    console.log(`[UsersList] Skipping profile load, too soon after last fetch (${timeSinceLastFetch}ms)`);
                    // Still update the processed members ref so we don't keep checking
                    processedMembersRef.current = memberIds;
                    return;
                }

                console.log(`[UsersList] Member list changed (${members.length} members), loading profiles`);
                processedMembersRef.current = memberIds;
                lastFetchAttemptRef.current = now;

                // Use a timeout to prevent rapid successive loads
                setTimeout(() => {
                    loadMembersProfiles(members);
                }, 100);
            }
        }
    }, [showUsers, members, isLoadingProfiles, loadMembersProfiles]);

    // Handle retrying the member fetch for servers previously marked as invalid
    const handleRetryFetch = async () => {
        if (!activeServerId) return;

        setIsRetrying(true);
        try {
            console.log(`[UsersList] Retrying member fetch for previously invalid server: ${activeServerId}`);
            await fetchServerMembers(activeServerId, true);

            // If we got members, load their profiles
            const currentMembers = getServerMembers(activeServerId);
            if (currentMembers && currentMembers.length > 0) {
                await loadMembersProfiles(currentMembers);
            }
            // Reset failure flag when user manually retries
            fetchFailedRef.current = false;
            hasLoadedProfilesRef.current = true;
            lastFetchAttemptRef.current = Date.now();
        } catch (error) {
            console.error("[UsersList] Error retrying member fetch:", error);
            fetchFailedRef.current = true;
        } finally {
            setIsRetrying(false);
        }
    };

    // Get display name for a member
    const getDisplayName = (member: Member) => {
        // Prioritize server nickname if available
        if (member.nickname) {
            return member.nickname;
        }

        // Try to get primaryName if available
        const profileData = getUserProfileFromCache(member.id);
        if (profileData?.primaryName) {
            return profileData.primaryName;
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

    // Check if we have a members endpoint failure
    const hasServerMembersError = members && Array.isArray(members) && members.length === 0 && activeServer?.member_count;

    // Check if this server is in the invalid members list
    const isServerMarkedInvalid = activeServerId ? invalidMemberServers.has(activeServerId) : false;

    // Ensure primary names for all displayed members
    useEffect(() => {
        if (members && members.length > 0 && !isLoadingProfiles) {
            // Find members without primary names in the cache
            const membersNeedingPrimaryName = members.filter(member => {
                const cachedProfile = getUserProfileFromCache(member.id);
                return !cachedProfile?.primaryName;
            });

            if (membersNeedingPrimaryName.length > 0) {
                console.log(`[UsersList] Fetching primary names for ${membersNeedingPrimaryName.length} members`);

                // Load primary names for these members (one at a time to avoid overwhelming the network)
                const loadPrimaryNames = async () => {
                    for (const member of membersNeedingPrimaryName) {
                        // Skip if component unmounted
                        if (abortControllerRef.current?.signal.aborted) break;

                        await fetchUserProfileAndCache(member.id, true);
                        // Add a small delay between requests
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                };

                loadPrimaryNames();
            }
        }
    }, [members, isLoadingProfiles, getUserProfileFromCache, fetchUserProfileAndCache]);

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
                {!members ? (
                    // Show placeholders when members is null (still loading)
                    <div className="space-y-1">
                        {generatePlaceholderMembers()}
                    </div>
                ) : members.length === 0 && hasServerMembersError ? (
                    // Only show error when we have no data AND the server has error
                    <div className="p-4 text-sm flex flex-col items-center text-center gap-3 text-muted-foreground">
                        <AlertCircle className="h-5 w-5" />
                        <p>This server does not support member listing.</p>
                        <div className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                            The server admin must update the server source code to add member listing functionality.
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={handleRetryFetch}
                            disabled={isRetrying}
                        >
                            {isRetrying ? (
                                <>
                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                    Retrying...
                                </>
                            ) : (
                                <>
                                    <RefreshCcw className="h-3 w-3 mr-2" />
                                    Retry
                                </>
                            )}
                        </Button>
                    </div>
                ) : members.length === 0 ? (
                    // Empty state with no error - just show placeholders
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