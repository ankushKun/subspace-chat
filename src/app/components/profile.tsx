import { Mic, Headphones, Settings, LogOut, User, Upload, X, Pencil, Save, Loader2 } from 'lucide-react'
import { useActiveAddress, useConnection } from '@arweave-wallet-kit/react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMobile } from "@/hooks";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel
} from '@/components/ui/alert-dialog';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProfile, updateProfile, uploadFileAndGetId, updateNickname } from '@/lib/ao';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { useGlobalState } from '@/hooks/global-state';
import { FileDropzone } from '@/components/ui/file-dropzone';

export default function Profile() {
    const activeAddress = useActiveAddress();
    const { disconnect } = useConnection();
    const isMobile = useMobile();
    const [profileOpen, setProfileOpen] = useState(false);
    const {
        activeServerId,
        activeServer,
        getUserProfile,
        fetchUserProfile,
        userProfile,
        getUserProfileFromCache,
        updateUserProfileCache,
        fetchUserProfileAndCache,
        getServerMembers
    } = useGlobalState();
    const previousAddressRef = useRef<string | null>(null);
    const primaryNameCheckedRef = useRef<boolean>(false);
    const navigate = useNavigate();

    // Profile state
    const [isLoading, setIsLoading] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [nickname, setNickname] = useState("");
    const [profilePic, setProfilePic] = useState<File | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Stabilize profile display when hovering by caching profile name
    const [cachedDisplayName, setCachedDisplayName] = useState<string | null>(null);

    // Update cached display name whenever profile data changes
    useEffect(() => {
        if (profileData?.primaryName) {
            setCachedDisplayName(profileData.primaryName);
        }
    }, [profileData]);

    // Watch for address changes
    useEffect(() => {
        // If address changed, reset and fetch new profile data
        if (activeAddress !== previousAddressRef.current) {
            console.log(`[Profile] Wallet address changed from ${previousAddressRef.current} to ${activeAddress}`);
            // Reset profile data immediately
            setProfileData(null);
            setNickname("");
            primaryNameCheckedRef.current = false;
            setCachedDisplayName(null);

            // Update the ref to current address
            previousAddressRef.current = activeAddress;

            // If we have a previous address (not initial load), navigate to /app
            if (previousAddressRef.current !== null) {
                console.log(`[Profile] Navigating to /app due to wallet address change`);
                navigate('/app');
            }

            // If we have a new address, immediately fetch fresh profile data
            // This ensures we don't show stale data from the previous wallet
            if (activeAddress) {
                setIsLoading(true);
                fetchUserProfile(activeAddress, true)
                    .then(result => {
                        if (result && 'profile' in result) {
                            console.log(`[Profile] Updated profile data for new wallet ${activeAddress}`);
                            setProfileData(result);

                            // Ensure primary name is in the user profiles cache
                            if (result.primaryName) {
                                updateUserProfileCache(activeAddress, {
                                    username: result.profile?.username,
                                    pfp: result.profile?.pfp,
                                    primaryName: result.primaryName,
                                    timestamp: Date.now()
                                });
                                primaryNameCheckedRef.current = true;
                                setCachedDisplayName(result.primaryName);
                            }
                        }
                    })
                    .catch(error => {
                        console.error(`[Profile] Error fetching profile for new wallet:`, error);
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            }
        }
    }, [activeAddress, fetchUserProfile, navigate, updateUserProfileCache]);

    // Load cached profile data when component mounts
    useEffect(() => {
        if (activeAddress) {
            // Try to get profile from cache first
            const cachedProfile = getUserProfile();

            // Make sure the cached profile is for the current wallet address
            const profileAddress = userProfile?.data?.json?.id ||
                userProfile?.data?.profile?.id;

            if (cachedProfile && profileAddress === activeAddress) {
                console.log(`[Profile] Using cached profile data for ${activeAddress}`);
                setProfileData(cachedProfile);

                // Check if cached profile has primaryName
                if (cachedProfile.primaryName) {
                    // Ensure it's also in the user profiles cache for consistent display
                    updateUserProfileCache(activeAddress, {
                        username: cachedProfile.profile?.username,
                        pfp: cachedProfile.profile?.pfp,
                        primaryName: cachedProfile.primaryName,
                        timestamp: Date.now()
                    });
                    primaryNameCheckedRef.current = true;
                    setCachedDisplayName(cachedProfile.primaryName);
                }
            } else if (!profileData && !isLoading) {
                // If no matching cache, start a fetch
                console.log(`[Profile] No matching cached profile, fetching new data`);
                fetchProfile();
            }
        }
    }, [activeAddress, getUserProfile, userProfile, updateUserProfileCache]);

    // Check for primary name if not already loaded
    useEffect(() => {
        if (activeAddress && profileData && !primaryNameCheckedRef.current && !isLoading) {
            // If we have profile data but no primary name, try to fetch it specifically
            if (!profileData.primaryName) {
                console.log(`[Profile] No primary name found, fetching it specifically`);
                fetchUserProfileAndCache(activeAddress, true)
                    .then(result => {
                        if (result && result.primaryName) {
                            console.log(`[Profile] Successfully fetched primary name: ${result.primaryName}`);
                            // Update the current profile data with the primary name
                            setProfileData(prev => ({
                                ...prev,
                                primaryName: result.primaryName
                            }));
                            // Also update the cached display name
                            setCachedDisplayName(result.primaryName);
                        }
                    })
                    .catch(error => {
                        console.error(`[Profile] Error fetching primary name:`, error);
                    })
                    .finally(() => {
                        primaryNameCheckedRef.current = true;
                    });
            } else {
                primaryNameCheckedRef.current = true;
                // Ensure cached display name is set from profile data
                setCachedDisplayName(profileData.primaryName);
            }
        }
    }, [activeAddress, profileData, isLoading, fetchUserProfileAndCache]);

    // Get server-specific nickname when active server changes
    useEffect(() => {
        if (activeServerId && activeAddress) {
            // Get members from current server
            const members = getServerMembers(activeServerId);
            if (members) {
                // Find current user in members
                const currentMember = members.find(m => m.id === activeAddress);
                if (currentMember) {
                    // Set nickname from server data
                    setNickname(currentMember.nickname || "");
                } else {
                    // Reset nickname if not found
                    setNickname("");
                }
            }
        }
    }, [activeServerId, activeAddress, getServerMembers]);

    // Fetch profile when dialog opens if no cached data
    useEffect(() => {
        if (profileOpen && activeAddress && !profileData) {
            fetchProfile();
        }
    }, [profileOpen, activeAddress, profileData]);

    // Reset edit mode when dialog closes
    useEffect(() => {
        if (!profileOpen) {
            setIsEditing(false);
        }
    }, [profileOpen]);

    // Fetch user profile
    const fetchProfile = async () => {
        if (!activeAddress) return;

        setIsLoading(true);
        primaryNameCheckedRef.current = false;

        try {
            // Always force a fresh fetch when the profile dialog is opened
            // This ensures we get the latest data for the current wallet
            console.log(`[Profile] Forcing fresh profile data fetch for ${activeAddress}`);
            const result = await fetchUserProfile(activeAddress, true);

            if (result && 'profile' in result) {
                setProfileData(result);

                // Ensure primary name is also in the user profiles cache
                if (result.primaryName) {
                    updateUserProfileCache(activeAddress, {
                        username: result.profile?.username,
                        pfp: result.profile?.pfp,
                        primaryName: result.primaryName,
                        timestamp: Date.now()
                    });
                    primaryNameCheckedRef.current = true;
                    setCachedDisplayName(result.primaryName);
                }
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
            toast.error("Failed to load profile");
        } finally {
            setIsLoading(false);
        }
    };

    // Save profile changes
    const handleSaveProfile = async () => {
        if (!activeAddress || !activeServerId) return;

        setIsSaving(true);
        try {
            let pfpId = profileData?.profile?.pfp;
            let nicknameUpdated = false;

            // Upload new profile picture if one was selected
            if (profilePic) {
                toast.loading("Uploading profile picture...");
                pfpId = await uploadFileAndGetId(profilePic);
                toast.dismiss();
            }

            // Update global profile picture
            if (profilePic) {
                toast.loading("Updating profile picture...");
                await updateProfile(undefined, pfpId);
                toast.dismiss();
            }

            // Update server-specific nickname
            if (nickname !== getServerNickname()) {
                toast.loading("Updating server nickname...");
                const nicknameResult = await updateNickname(activeServerId, nickname);
                toast.dismiss();
                // Type-safe check if the result has a success property that is false
                nicknameUpdated = !!(nicknameResult && typeof nicknameResult === 'object' && 'success' in nicknameResult ? nicknameResult.success !== false : true);
            }

            // Show success toast only if something was updated
            if (profilePic || nicknameUpdated) {
                toast.success("Profile updated successfully");
            }

            // Local state update for immediate UI feedback if nickname update appears successful
            if (nicknameUpdated) {
                setNickname(nickname);
            }

            // Add a small delay to ensure backend has processed the update
            await new Promise(resolve => setTimeout(resolve, 500));

            // Explicitly fetch the latest profile data with cache bypass
            console.log(`[Profile] Fetching updated profile data after profile update`);
            const updatedProfile = await fetchUserProfile(activeAddress, true);

            if (updatedProfile) {
                console.log(`[Profile] Profile data refreshed successfully after update`);
                setProfileData(updatedProfile);

                // Also update the user profiles cache to ensure it's reflected everywhere in the app
                if (activeAddress) {
                    console.log(`[Profile] Updating user profiles cache with latest data`);
                    updateUserProfileCache(activeAddress, {
                        pfp: updatedProfile.profile?.pfp,
                        primaryName: updatedProfile.primaryName,
                        timestamp: Date.now()
                    });
                }

                // The server members should already be updated through the optimized caching in updateNickname
            } else {
                console.warn(`[Profile] Failed to get updated profile data after update`);
                // Fallback to fetching profile directly if the global state method failed
                try {
                    const freshProfileData = await getProfile(activeAddress);
                    if (freshProfileData && typeof freshProfileData === 'object' && 'profile' in freshProfileData) {
                        setProfileData(freshProfileData);
                        // Type assertion to tell TypeScript this is a record with a profile property
                        const typedProfile = freshProfileData as Record<string, any>;

                        // Update user profiles cache here too for the fallback
                        updateUserProfileCache(activeAddress, {
                            pfp: typedProfile.profile?.pfp,
                            primaryName: typedProfile.primaryName,
                            timestamp: Date.now()
                        });
                    }
                } catch (err) {
                    console.error(`[Profile] Error in fallback profile fetch:`, err);
                }
            }

            setIsEditing(false);
            setProfilePic(null);
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.dismiss();
            toast.error("Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setIsEditing(false);
        // Reload nickname from server members
        if (activeServerId && activeAddress) {
            const members = getServerMembers(activeServerId);
            if (members) {
                const currentMember = members.find(m => m.id === activeAddress);
                setNickname(currentMember?.nickname || "");
            }
        }
        setProfilePic(null);
    };

    const hovered = () => {
        setIsHovered(true);
    };

    const unhovered = () => {
        setIsHovered(false);
    };

    // Get display name prioritizing primaryName (AR name) or wallet address
    const getDisplayName = () => {
        // First priority: use cached display name to prevent flickering
        if (cachedDisplayName) {
            return cachedDisplayName;
        }

        // Second priority: use current profile data if available
        if (profileData?.primaryName) {
            return profileData.primaryName;
        }

        // Last resort: truncated wallet address
        if (activeAddress) {
            return `${activeAddress.substring(0, 6)}...${activeAddress.substring(activeAddress.length - 4)}`;
        }

        return 'Not Connected';
    };

    // Get formatted wallet address
    const getWalletAddress = () => {
        if (!activeAddress) return 'Not Connected';
        return `${activeAddress.substring(0, 6)}...${activeAddress.substring(activeAddress.length - 4)}`;
    };

    // Get nickname from current server
    const getServerNickname = () => {
        if (!activeServerId || !activeAddress) return null;

        const members = getServerMembers(activeServerId);
        if (!members) return null;

        const currentMember = members.find(m => m.id === activeAddress);
        return currentMember?.nickname || null;
    };

    return (
        <div className="mt-auto w-full border-t flex items-center justify-between border-border/30 p-2 bg-background/50 backdrop-blur-[2px]">
            <DropdownMenu>
                <DropdownMenuTrigger className='w-full' asChild onMouseEnter={hovered} onMouseLeave={unhovered}>
                    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/40 transition-colors cursor-pointer">
                        {/* User avatar */}
                        <div className="relative">
                            <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${(cachedDisplayName || profileData?.primaryName) ? 'bg-amber-800/30' : 'bg-primary/20'
                                }`}>
                                {activeAddress ? (
                                    profileData?.profile?.pfp ? (
                                        <img
                                            src={`https://arweave.net/${profileData.profile.pfp}`}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-medium">{activeAddress.substring(0, 2)}</span>
                                    )
                                ) : (
                                    <span className="text-xs">?</span>
                                )}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background"></div>
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                                {getDisplayName()}
                            </div>
                            <div className="flex flex-col">
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>

                                    {/* Always show nickname or wallet address, then swap with wallet address on hover */}
                                    <span className={isHovered ? 'hidden' : ''}>
                                        {getServerNickname() || getWalletAddress()}
                                    </span>

                                    {/* Show wallet address on hover */}
                                    <span className={!isHovered ? 'hidden' : ''}>
                                        {getWalletAddress()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    data-mobile={isMobile}
                    className="p-2 -ml-2 data-[mobile=true]:!w-[calc(100vw-88px)] data-[mobile=false]:!min-w-[333px] space-y-1 bg-background/95 backdrop-blur-sm"
                    sideOffset={4}
                >
                    <DropdownMenuItem
                        onClick={() => setProfileOpen(true)}
                        className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                    >
                        <User className="h-4 w-4" />
                        <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            disconnect();
                            navigate('/app');
                        }}
                        className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Control buttons */}
            <div className="flex items-center gap-1 px-2">
                <Link to="/app/settings">
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Settings">
                        <Settings className="w-4 h-4" />
                    </Button>
                </Link>
            </div>

            <AlertDialog open={profileOpen} onOpenChange={setProfileOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center justify-between">
                            <span>Your Profile</span>
                            {!isEditing && activeServerId && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={() => setIsEditing(true)}
                                    disabled={isLoading}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span>Edit</span>
                                </Button>
                            )}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {activeServerId
                                ? "Your server nickname and profile picture are visible to other members."
                                : "Select a server first to set your server-specific nickname."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        {isLoading ? (
                            <div className="space-y-4">
                                <div className="flex justify-center">
                                    <Skeleton className="w-24 h-24 rounded-full" />
                                </div>
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : isEditing && activeServerId ? (
                            <div className="space-y-4">
                                <FileDropzone
                                    onFileChange={setProfilePic}
                                    currentFile={profileData?.profile?.pfp}
                                    label="Profile Picture"
                                    previewType="circle"
                                    placeholder="Drag & drop profile picture or click to select"
                                />

                                <div className="space-y-2">
                                    <Label htmlFor="nickname">Server Nickname</Label>
                                    <Input
                                        id="nickname"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="Enter a nickname for this server"
                                    />
                                    <p className="text-xs text-muted-foreground">This nickname will only be shown in {activeServer?.name || "this server"}.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center justify-center">
                                    <div className={`w-24 h-24 rounded-full overflow-hidden mb-2 flex items-center justify-center ${(cachedDisplayName || profileData?.primaryName) ? 'bg-amber-800/30' : 'bg-muted'
                                        }`}>
                                        {profileData?.profile?.pfp ? (
                                            <img
                                                src={`https://arweave.net/${profileData.profile.pfp}`}
                                                alt="Profile picture"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            activeAddress ? (
                                                <span className="text-xl font-medium">{activeAddress.substring(0, 2)}</span>
                                            ) : (
                                                <User className="h-10 w-10 text-muted-foreground" />
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground">Primary Name</h3>
                                        <p className="text-base">
                                            {cachedDisplayName || profileData?.primaryName ||
                                                <span className="text-muted-foreground">None</span>
                                            }
                                        </p>
                                        {!(cachedDisplayName || profileData?.primaryName) && (
                                            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                                                <span className="text-amber-500">ℹ️</span>
                                                <span>You can get your own Primary Name at <a href="https://arns.ar.io" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">arns.ar.io</a></span>
                                            </div>
                                        )}
                                    </div>

                                    {activeServerId && (
                                        <div>
                                            <h3 className="text-sm font-medium text-muted-foreground">Server Nickname</h3>
                                            <p className="text-base">
                                                {getServerNickname() ||
                                                    <span className="text-muted-foreground italic">No server nickname set</span>
                                                }
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground">Wallet Address</h3>
                                        <p className="text-sm font-mono bg-muted rounded-md p-2 overflow-x-auto">
                                            {activeAddress || 'Not connected'}
                                        </p>
                                        {(cachedDisplayName || profileData?.primaryName) && (
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {/* Using non-breaking space between words */}
                                                <span className="text-green-500">✓</span> Primary&#8209;Name registered
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <AlertDialogFooter>
                        {isEditing ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={isSaving || !activeServerId}
                                    className="flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </>
                        ) : (
                            <Button onClick={() => setProfileOpen(false)}>Close</Button>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}