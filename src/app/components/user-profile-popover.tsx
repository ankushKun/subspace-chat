import { useState, useEffect } from 'react';
import { User, Loader2, Copy, CheckIcon, ExternalLink } from 'lucide-react';
import { useGlobalState } from '@/hooks/global-state';
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface UserProfilePopoverProps {
    userId: string | null;
    children: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    sideOffset?: number;
}

export default function UserProfilePopover({
    userId,
    children,
    side = "right",
    align = "center",
    sideOffset = 8
}: UserProfilePopoverProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [hasCopied, setHasCopied] = useState(false);
    const [open, setOpen] = useState(false);

    const {
        getUserProfileFromCache,
        updateUserProfileCache,
        fetchUserProfileAndCache
    } = useGlobalState();

    // Fetch user profile data when the popover opens or userId changes
    useEffect(() => {
        if (open && userId) {
            // Try to get from cache for initial display
            const cachedData = getUserProfileFromCache(userId);
            if (cachedData) {
                console.log(`[UserProfilePopover] Using cached profile for ${userId}`);
            }

            // Fetch fresh data regardless of cache
            setIsLoading(true);
            fetchLatestProfileData();
        }

        // Reset state when popover closes
        if (!open) {
            setHasCopied(false);
        }
    }, [open, userId]);

    // Function to fetch the latest profile data
    const fetchLatestProfileData = async () => {
        if (!userId) return;

        try {
            console.log(`[UserProfilePopover] Fetching latest profile for ${userId}`);

            // Always force a fresh fetch to get the latest data
            const result = await fetchUserProfileAndCache(userId, true);

            if (result) {
                console.log(`[UserProfilePopover] Successfully fetched profile data`);
                setProfileData(result);
            } else {
                console.warn(`[UserProfilePopover] No profile data found for ${userId}`);
                // Still set minimal data even if the fetch failed
                setProfileData({ profile: {}, id: userId });
            }
        } catch (error) {
            console.error(`[UserProfilePopover] Error fetching profile:`, error);
            setProfileData({ profile: {}, id: userId });
        } finally {
            setIsLoading(false);
        }
    };

    // Function to copy user ID to clipboard
    const copyUserId = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userId) return;

        navigator.clipboard.writeText(userId);
        setHasCopied(true);
        toast.success("Wallet address copied to clipboard");

        // Reset copy state after 2 seconds
        setTimeout(() => {
            setHasCopied(false);
        }, 2000);
    };

    // Get username from profile data or fall back to wallet address
    const getDisplayName = () => {
        if (!profileData) return 'Unknown User';

        if (profileData.profile?.username) {
            return profileData.profile.username;
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
                className="p-0 w-[280px]"
            >
                <div className="p-4 space-y-4">
                    {isLoading && !profileData ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-12 h-12 rounded-full" />
                                <div className="flex-1">
                                    <Skeleton className="h-4 w-24 mb-2" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                                    {profileData?.profile?.pfp ? (
                                        <img
                                            src={`https://arweave.net/${profileData.profile.pfp}`}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = '';
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.innerHTML = getDisplayName().substring(0, 2).toUpperCase();
                                            }}
                                        />
                                    ) : (
                                        <span className="text-lg font-medium">
                                            {getDisplayName().substring(0, 2).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-medium text-base">{getDisplayName()}</h3>
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

                            {userId && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs w-full"
                                    onClick={() => window.open(`https://viewblock.io/arweave/address/${userId}`, '_blank')}
                                >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View on ViewBlock
                                </Button>
                            )}

                            {isLoading && (
                                <div className="flex justify-center text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    <span>Refreshing profile data...</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
} 