import { useGlobalState } from "@/hooks/global-state";
import { useMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserIcon, Loader2, ShieldIcon, AlertCircle, RefreshCcw } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { getProfile } from "@/lib/ao";
import type { Member } from "@/lib/types";
import { useActiveAddress } from "@arweave-wallet-kit/react";
import { Skeleton } from "@/components/ui/skeleton";

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
        invalidMemberServers
    } = useGlobalState();
    const [profiles, setProfiles] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const isMobile = useMobile();
    const activeAddress = useActiveAddress();
    const isFetchingProfiles = useRef(false);
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
        }
    }, [showUsers, activeServerId]);

    // Reset profiles when server changes
    useEffect(() => {
        // Clear profiles when server changes
        setProfiles({});

        // Abort any ongoing fetches when server changes
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        isFetchingProfiles.current = false;
    }, [activeServerId]);

    // Separate fetch function to avoid dependency issues
    const fetchProfile = useCallback(async (memberId: string, signal: AbortSignal) => {
        try {
            return await getProfile(memberId);
        } catch (error) {
            if (signal.aborted) {
                console.log('Profile fetch aborted for', memberId);
            } else {
                console.warn(`Failed to fetch profile for ${memberId}:`, error);
            }
            return null;
        }
    }, []);

    // Fetch profiles for members when the member list changes
    useEffect(() => {
        if (!members || members.length === 0) return;

        // Create a new abort controller for this fetch session
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const signal = abortController.signal;

        // Avoid duplicate fetches
        if (isFetchingProfiles.current) return;

        const fetchMemberProfiles = async () => {
            isFetchingProfiles.current = true;

            try {
                // We'll collect all profile updates and apply them at once
                let updatedProfiles = false;
                const newProfiles = { ...profiles };

                // Process members sequentially with delays instead of in parallel
                for (const member of members) {
                    // Break if component unmounted or fetch aborted
                    if (signal.aborted) break;

                    // Skip if we already have profile data for this member
                    if (newProfiles[member.id]?.profile) continue;

                    const profileData = await fetchProfile(member.id, signal);

                    // Only update if we got data and haven't been aborted
                    if (!signal.aborted && profileData) {
                        newProfiles[member.id] = { profile: profileData };
                        updatedProfiles = true;
                    }

                    // Add a delay between requests to avoid rate limiting
                    if (!signal.aborted) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                // Only update state once at the end if needed
                if (updatedProfiles && !signal.aborted) {
                    setProfiles(newProfiles);
                }
            } catch (error) {
                console.error("Error in profile fetching process:", error);
            } finally {
                if (!signal.aborted) {
                    isFetchingProfiles.current = false;
                }
            }
        };

        fetchMemberProfiles();

        // Cleanup function to abort fetches on unmount or dependency change
        return () => {
            abortController.abort();
            abortControllerRef.current = null;
        };
    }, [members, fetchProfile, profiles]); // Only depend on members and fetchProfile, not profiles

    // Function to initiate a refresh of all member profiles
    const refreshAllProfiles = useCallback(async () => {
        if (!members || members.length === 0) return;

        // Don't start if we're already fetching
        if (isFetchingProfiles.current) return;

        console.log(`[UsersList] Refreshing all member profiles for ${members.length} members`);

        // Create a new abort controller for this refresh session
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const signal = abortController.signal;

        isFetchingProfiles.current = true;

        try {
            const newProfiles = { ...profiles };
            let updatedProfiles = false;

            // Process a few members at a time with small delays
            // to avoid rate limiting and UI blocking
            for (let i = 0; i < members.length; i++) {
                if (signal.aborted) break;

                const member = members[i];

                // Fetch fresh profile data (even if we already have cached data)
                const profileData = await fetchProfile(member.id, signal);

                // Update profile data if we got a valid response
                if (!signal.aborted && profileData) {
                    newProfiles[member.id] = { profile: profileData };
                    updatedProfiles = true;
                }

                // Add a small delay between requests
                if (!signal.aborted && i < members.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            // Update state if we got new data
            if (updatedProfiles && !signal.aborted) {
                setProfiles(newProfiles);
            }
        } catch (error) {
            console.error("[UsersList] Error refreshing profiles:", error);
        } finally {
            if (!signal.aborted) {
                isFetchingProfiles.current = false;
            }
        }
    }, [members, profiles, fetchProfile]);

    // Trigger refreshing all profiles when the panel becomes visible
    useEffect(() => {
        if (showUsers && members && members.length > 0) {
            // Small delay to avoid blocking the UI rendering
            setTimeout(() => {
                refreshAllProfiles();
            }, 500);
        }

        // Clean up any pending refreshes when the panel is hidden
        return () => {
            if (!showUsers && abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
                isFetchingProfiles.current = false;
            }
        };
    }, [showUsers, members, refreshAllProfiles]);

    // Get display name for a member
    const getDisplayName = (member: Member) => {
        // Try to get username from profile
        if (profiles[member.id]?.profile?.username) {
            return profiles[member.id].profile.username;
        }

        // Fall back to nickname if available
        if (member.nickname) {
            return member.nickname;
        }

        // Fall back to truncated ID
        return member.id.substring(0, 6) + '...' + member.id.substring(member.id.length - 4);
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

    // Handle retrying the member fetch for servers previously marked as invalid
    const handleRetryFetch = async () => {
        if (!activeServerId) return;

        setIsRetrying(true);
        try {
            console.log(`[UsersList] Retrying member fetch for previously invalid server: ${activeServerId}`);
            await fetchServerMembers(activeServerId, true);
        } catch (error) {
            console.error("[UsersList] Error retrying member fetch:", error);
        } finally {
            setIsRetrying(false);
        }
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
                            <div
                                key={member.id}
                                className="flex items-center gap-2 p-2 hover:bg-accent rounded-md transition-colors"
                            >
                                <div className="h-8 w-8 mx-2 mr-4 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary">
                                    {profiles[member.id]?.profile?.pfp ? (
                                        <img
                                            src={`https://arweave.net/${profiles[member.id].profile.pfp}`}
                                            alt={getDisplayName(member)}
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        getDisplayName(member).charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm truncate">
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
                    </div>
                )}
            </div>
        </div>
    );
}