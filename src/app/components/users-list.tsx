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

    // Get members from global state
    const members = activeServerId ? getServerMembers(activeServerId) : null;

    // Refresh member data when the panel becomes visible
    useEffect(() => {
        // When the users panel becomes visible, refresh member data
        if (showUsers && activeServerId) {
            console.log(`[UsersList] Panel became visible, refreshing members for ${activeServerId}`);

            // Get a reference to the global state
            const globalState = useGlobalState.getState();

            // Background refresh members with slight delay to allow UI to render first
            setTimeout(() => {
                globalState.fetchServerMembers(activeServerId, true)
                    .catch(error => console.warn("[UsersList] Failed to refresh members data:", error));
            }, 150);

            // Check if we have members and need to load their profiles
            if (members && members.length > 0) {
                loadMembersProfiles(members);
            }
        }

        // Clean up abort controller on unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [showUsers, activeServerId, members]);

    // This function loads profiles for all members in batches
    const loadMembersProfiles = async (membersList: Member[]) => {
        if (!membersList || membersList.length === 0) return;

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

            // Process members in batches to avoid rate limiting
            for (let i = 0; i < membersToLoad.length; i++) {
                // Break if component unmounted or fetch aborted
                if (signal.aborted) break;

                const member = membersToLoad[i];

                // Prioritize loading the current user's profile from global state
                if (member.id === activeAddress) {
                    const currentUserProfile = getUserProfile();
                    if (currentUserProfile && currentUserProfile.profile) {
                        updateUserProfileCache(member.id, {
                            username: currentUserProfile.profile.username,
                            pfp: currentUserProfile.profile.pfp,
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
    };

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
        } catch (error) {
            console.error("[UsersList] Error retrying member fetch:", error);
        } finally {
            setIsRetrying(false);
        }
    };

    // Get display name for a member
    const getDisplayName = (member: Member) => {
        // Try to get username from profile cache
        const profileData = getUserProfileFromCache(member.id);
        if (profileData?.username) {
            return profileData.username;
        }

        // Fall back to nickname if available
        if (member.nickname) {
            return member.nickname;
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
                                            <span className="text-xs text-muted-foreground truncate">
                                                {member.id.substring(0, 6)}...{member.id.substring(member.id.length - 4)}
                                            </span>
                                        </div>
                                    </div>
                                </PopoverTrigger>
                            </UserProfilePopover>
                        ))}

                        {/* Show retry button below the list if the server is marked invalid but we have cached data */}
                        {isServerMarkedInvalid && members.length > 0 && (
                            <div className="pt-2 pb-1 flex flex-col items-center">
                                <div className="text-xs text-muted-foreground mb-1">
                                    Using cached member data
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRetryFetch}
                                    disabled={isRetrying}
                                >
                                    {isRetrying ? (
                                        <>
                                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                            Refreshing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCcw className="h-3 w-3 mr-2" />
                                            Refresh
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Loading indicator when refreshing profiles */}
                        {isLoadingProfiles && (
                            <div className="pt-2 pb-1 flex flex-col items-center">
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Loading user profiles...
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}