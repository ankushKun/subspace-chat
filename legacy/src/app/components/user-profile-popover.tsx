import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Copy, CheckIcon, ArrowUpRight, Badge, MessagesSquare, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useGlobalState } from "@/hooks/global-state";
import { useWallet } from '@/hooks/use-wallet';
import { getProfile, getSingleMember } from "@/lib/ao";

interface UserProfilePopoverProps {
    userId: string;
    children: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    sideOffset?: number;
}

interface ProfileData {
    username?: string;
    pfp?: string;
    primaryName?: string;
    nickname?: string;
    timestamp: number;
}

export default function UserProfilePopover({
    userId,
    children,
    side = "right",
    align = "center",
    sideOffset = 8
}: UserProfilePopoverProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [open, setOpen] = useState(false);
    const [hasCopied, setHasCopied] = useState(false);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const loadAttemptRef = useRef(0);
    const profileFetchedRef = useRef(false);
    const navigate = useNavigate();
    const { address: activeAddress } = useWallet();
    const {
        getUserProfileFromCache,
        fetchUserProfileAndCache,
        activeServerId,
        getServerMembers
    } = useGlobalState();

    // Load profile data when popover opens
    useEffect(() => {
        // Use loading timeout to avoid flashing skeleton for fast loads
        if (open) {
            // Show loading state only after a small delay
            loadingTimeoutRef.current = setTimeout(() => {
                if (!profileData && !profileFetchedRef.current) {
                    setIsLoading(true);
                }
            }, 100);

            // Try to get from cache first for immediate display
            const cachedProfile = getUserProfileFromCache(userId);
            if (cachedProfile) {
                console.log(`[UserProfilePopover] Using cached profile for ${userId}`);
                setProfileData(cachedProfile);
                setIsLoading(false);
            }

            // Always fetch fresh data when opened
            console.log(`[UserProfilePopover] Fetching fresh profile data for ${userId}`);
            refreshAllProfileData();
            profileFetchedRef.current = true;
        } else {
            // Reset fetch flag when popover closes
            profileFetchedRef.current = false;
        }

        // Cleanup on unmount or when popover closes
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
        };
    }, [open, userId, getUserProfileFromCache]);

    // Refresh all profile data (global and server-specific)
    const refreshAllProfileData = async () => {
        if (!userId) return;

        setIsRefreshing(true);
        loadAttemptRef.current += 1;
        const currentAttempt = loadAttemptRef.current;

        try {
            // Start all fetches concurrently
            const [globalProfilePromise, serverMemberPromise] = [
                getProfile(userId),
                activeServerId ? getSingleMember(activeServerId, userId) : Promise.resolve(null)
            ];

            // Wait for both to complete
            const [globalProfile, serverMember] = await Promise.all([
                globalProfilePromise,
                serverMemberPromise
            ]);

            // Only update if this is still the most recent request
            if (currentAttempt === loadAttemptRef.current) {
                // Update global profile cache
                if (globalProfile) {
                    const profileUpdate: ProfileData = {
                        username: globalProfile.profile?.username,
                        pfp: globalProfile.profile?.pfp,
                        primaryName: globalProfile.primaryName,
                        timestamp: Date.now()
                    };

                    // If we have server-specific data, include it
                    if (serverMember) {
                        profileUpdate.nickname = serverMember.nickname;
                    }

                    setProfileData(profileUpdate);

                    // Update the global cache
                    await fetchUserProfileAndCache(userId, true);

                    // Also update server members cache if we got new server member data
                    if (serverMember && activeServerId) {
                        const currentMembers = getServerMembers(activeServerId);
                        if (currentMembers) {
                            const updatedMembers = currentMembers.map(m =>
                                m.id === userId ? { ...m, ...serverMember } : m
                            );
                            const globalState = useGlobalState.getState();
                            globalState.serverMembers.set(activeServerId, {
                                data: updatedMembers,
                                timestamp: Date.now()
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[UserProfilePopover] Error refreshing profile data for ${userId}:`, error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    // Copy user ID to clipboard
    const copyUserId = () => {
        navigator.clipboard.writeText(userId);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    // Navigate to direct message with this user
    const openDirectMessage = () => {
        navigate(`/app/user/${userId}`);
        setOpen(false);
    };

    // Get nickname from current server
    const getServerNickname = () => {
        if (!activeServerId) return null;

        const members = getServerMembers(activeServerId);
        if (!members) return null;

        const userMember = members.find(m => m.id === userId);
        return userMember?.nickname || null;
    };

    // Get display name from profile data or fall back to wallet address
    const getDisplayName = () => {
        if (!profileData) return 'Unknown User';

        // First prioritize server-specific nickname
        const nickname = getServerNickname();
        if (nickname) {
            return nickname;
        }

        // Use primaryName if available
        if (profileData.primaryName) {
            return profileData.primaryName;
        }

        // Use username if available (typically not used in this app)
        if (profileData.username) {
            return profileData.username;
        }

        // Fallback to truncated wallet address
        if (userId) {
            return `${userId.substring(0, 6)}...${userId.substring(userId.length - 4)}`;
        }

        return 'Unknown User';
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {/* Trigger element wrapped around the children */}
            {children}

            {/* Popover content */}
            <PopoverContent
                side={side}
                align={align}
                sideOffset={sideOffset}
                className="w-80 p-0 shadow-lg flex flex-col relative"
            >
                {isLoading ? (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                        <Skeleton className="h-10 w-full mt-2" />
                    </div>
                ) : (
                    <div className="space-y-2">

                        {/* Loading indicator */}
                        {isRefreshing && (
                            <div className="absolute top-0.5 left-0 text-xs text-muted-foreground flex items-center gap-1.5 px-2 py-1 rounded-full">
                                <Loader2 className="h-3 w-3 animate-spin" />
                            </div>
                        )}

                        {/* User info header */}
                        <div className="p-4 space-y-4">
                            <div className="flex gap-3">
                                <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary">
                                    {profileData?.pfp ? (
                                        <img
                                            src={`https://arweave.net/${profileData.pfp}`}
                                            alt={getDisplayName()}
                                            className="object-cover w-full h-full"
                                            onError={(e) => {
                                                // Handle broken images
                                                e.currentTarget.src = '';
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.innerHTML = getDisplayName().charAt(0).toUpperCase();
                                            }}
                                        />
                                    ) : (
                                        getDisplayName().charAt(0).toUpperCase()
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-medium text-base">{getDisplayName()}</h3>
                                    {getServerNickname() && profileData?.primaryName && (
                                        <div className="text-sm text-muted-foreground">
                                            {profileData.primaryName}
                                        </div>
                                    )}
                                    <div className="text-xs text-muted-foreground flex items-center">
                                        <span className="truncate max-w-[150px]">{userId}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 ml-1"
                                            onClick={copyUserId}
                                        >
                                            {hasCopied ? (
                                                <CheckIcon className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={openDirectMessage}
                                    disabled={userId === activeAddress}
                                >
                                    <MessagesSquare className="h-4 w-4" />
                                    Message
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={() => window.open(`https://viewblock.io/arweave/address/${userId}`, '_blank')}
                                >
                                    <ArrowUpRight className="h-4 w-4" />
                                    View on Block
                                </Button>
                            </div>

                            {/* Status/badges section - placeholder for future use */}
                            {/*
                            <div className="mt-2">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Badge className="h-3 w-3" />
                                    <span>Offline</span>
                                </div>
                            </div>
                            */}
                        </div>

                        {/* <div className="border-t border-border"></div> */}

                        {/* Relationship section - placeholder for future use */}
                        {/*
                        <div className="p-4">
                            <h4 className="font-medium text-sm mb-2">Note</h4>
                            <input 
                                type="text"
                                className="w-full p-2 bg-muted/50 rounded text-sm"
                                placeholder="Click to add a note"
                            />
                        </div>
                        */}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
} 