import { Plus, Upload, File, X, Home, Users, PlusCircle, Loader2, RefreshCw, Trash2, Download, WalletCards } from "lucide-react"
import { toast } from "sonner"
import type { Server } from "@/lib/types"

import { Button } from "@/components/ui/button";
import { useGlobalState } from "@/hooks/global-state";
import { useState, useCallback, useEffect, useMemo } from "react";
import TextWLine from "@/components/text-w-line";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { createServer, getServerInfo, joinServer, getMembers } from "@/lib/ao";
import { Input } from "@/components/ui/input";
import { useDropzone } from "react-dropzone";
import * as Progress from "@radix-ui/react-progress";
import { ConnectionStrategies, useWallet } from '@/hooks/use-wallet';
import { useNavigate } from "react-router-dom";
import { FileDropzone } from "@/components/ui/file-dropzone";

// Helper function to clean up server data from browser storage
export function cleanupServerFromBrowserStorage(serverId: string) {
    try {
        console.log(`[cleanupServerFromBrowserStorage] Cleaning up storage for server: ${serverId}`);

        // Clean localStorage items related to this server
        const keysToCheck = [
            `server-${serverId}`,
            `server-members-${serverId}`,
            `server-messages-${serverId}`,
            `server-channels-${serverId}`,
            `server-categories-${serverId}`,
            `server-data-${serverId}`
        ];

        // Remove all potentially related keys
        keysToCheck.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (err) {
                console.warn(`Failed to remove ${key} from localStorage:`, err);
            }
        });

        // Find any other keys that might contain this server ID
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes(serverId)) {
                try {
                    localStorage.removeItem(key);
                    console.log(`Removed additional key from localStorage: ${key}`);
                } catch (err) {
                    console.warn(`Failed to remove ${key} from localStorage:`, err);
                }
            }
        }

        // Also attempt to remove from sessionStorage if used
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.includes(serverId)) {
                    sessionStorage.removeItem(key);
                    console.log(`Removed key from sessionStorage: ${key}`);
                }
            }
        } catch (err) {
            console.warn("Error cleaning up sessionStorage:", err);
        }

        console.log(`[cleanupServerFromBrowserStorage] Cleanup completed for server: ${serverId}`);
    } catch (error) {
        console.error("[cleanupServerFromBrowserStorage] Error cleaning up storage:", error);
    }
}

const sampleInvites = [
    "wLedDuEphwwvxLS-ftFb4mcXhqu4jwkYtIM4txCx2V8",
    "subspace.ar.io/#/invite/wLedDuEphwwvxLS-ftFb4mcXhqu4jwkYtIM4txCx2V8"
]

const ServerIcon = ({ id, refreshServerList }: { id: string, refreshServerList: () => void }) => {
    const navigate = useNavigate();
    const {
        activeServerId,
        activeServer,
        isLoadingServer,
        serverCache,
        refreshingServers,
        hasUnreadNotifications,
        getUnreadCount,
        fetchServerInfo
    } = useGlobalState();
    const [hover, setHover] = useState(false);

    const isActive = activeServerId === id;
    const hasUnread = hasUnreadNotifications(id);
    const unreadCount = getUnreadCount(id);

    // When this icon mounts, ensure we have server data (or start fetching it)
    useEffect(() => {
        if (!isActive) {
            // Check if we need to fetch server data
            const cachedData = serverCache.get(id);
            if (!cachedData || Date.now() - cachedData.timestamp > 3600000) { // 1 hour
                // Fetch data silently in the background
                fetchServerInfo(id, true);
            }
        }
    }, [id, isActive, serverCache, fetchServerInfo]);

    const handleMouseEnter = () => setHover(true);
    const handleMouseLeave = () => setHover(false);

    async function clicked() {
        // First navigate to the server
        navigate(`/app/${id}`);
        setHover(false);

        try {
            // Get global state to update
            const globalState = useGlobalState.getState();

            // Force refresh server info (silently in background)
            fetchServerInfo(id, true);

            // Also refresh server members
            console.log(`[ServerIcon] Force refreshing members for server: ${id}`);

            // Show a subtle loading indicator for members
            // Add to refreshing servers set
            globalState.refreshingServers.add(id);

            try {
                // Fetch fresh member data
                const { members } = await getMembers(id);

                // Update the members cache with the fresh data
                if (members && Array.isArray(members)) {
                    const now = Date.now();
                    globalState.serverMembers.set(id, {
                        data: members,
                        timestamp: now
                    });
                    console.log(`[ServerIcon] Updated members cache for ${id} with ${members.length} members`);

                    // If this server is now the active server, update its data
                    if (globalState.activeServerId === id && globalState.activeServer) {
                        globalState.setActiveServer({
                            ...globalState.activeServer,
                            // Preserve other properties but update members count if the property exists
                            ...(globalState.activeServer.member_count !== undefined ? { member_count: members.length } : {})
                        });
                    }
                }
            } catch (error) {
                console.warn(`[ServerIcon] Failed to refresh members for ${id}:`, error);
                // Non-critical error, don't show to user
            } finally {
                // Remove loading indicator after a short delay
                setTimeout(() => {
                    // Remove from refreshing servers set
                    globalState.refreshingServers.delete(id);
                }, 500);
            }
        } catch (error) {
            console.error(`[ServerIcon] Error refreshing server data for ${id}:`, error);
        }
    }

    // Get server info from the global state or cache
    const cachedData = serverCache.get(id);

    // Important: Only use activeServer data if this specific server is active
    // This prevents carrying over data from previous servers
    const serverInfo = isActive ? activeServer :
        (cachedData ? cachedData.data : null);

    // Determine if we're loading this specific server
    const isLoading = isActive && isLoadingServer;

    // Only show refreshing indicator if this specific server is being refreshed
    const isRefreshing = refreshingServers.has(id);

    // Determine if we have valid server data to display
    const hasServerData = serverInfo && serverInfo.icon;

    // If we don't have icon data yet, try to get it directly
    useEffect(() => {
        if (!hasServerData && !isLoading && !isRefreshing) {
            // Try to get server data silently in the background
            fetchServerInfo(id, true);
        }
    }, [id, hasServerData, isLoading, isRefreshing, fetchServerInfo]);

    return (
        <div className="relative group">
            <Button
                className="w-12 h-12 p-0 rounded-lg bg-transparent hover:bg-primary/5 relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={clicked}
            >
                <div
                    data-visible={hover || isActive}
                    data-expand={isActive}
                    className='w-[2px] absolute -left-2 z-10 bg-foreground rounded-r transition-all duration-100 h-2 data-[expand=true]:h-6 data-[visible=true]:opacity-100 data-[visible=false]:opacity-0'
                />

                {/* Loading state */}
                {isLoading && (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
                        <Skeleton className="h-full w-full rounded-lg" />
                    </div>
                )}

                {/* Server with data */}
                {!isLoading && hasServerData && (
                    <img
                        src={`https://arweave.net/${serverInfo.icon}`}
                        className='w-full h-full object-cover rounded-lg'
                        alt={serverInfo?.name || id}
                    />
                )}

                {/* Default placeholder when not loading but no data yet */}
                {!isLoading && !hasServerData && (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
                        <div className="w-6 h-6 bg-foreground/20 rounded-full" />
                    </div>
                )}

                {isRefreshing && !isLoading && (
                    <div className="absolute bottom-0 right-0 w-2 h-2">
                        <div className="animate-ping absolute h-2 w-2 rounded-full bg-palette-lavender opacity-75"></div>
                        <div className="relative rounded-full h-2 w-2 bg-palette-lavender"></div>
                    </div>
                )}

                {/* Unread notification indicator */}
                {hasUnread && !isActive && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full flex items-center justify-center text-xs min-w-4 h-4 px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </Button>

            {/* Server name tooltip */}
            <div
                className={`
                    absolute left-[calc(100%+5px)] top-[calc(50%-2.5px)] mb-2 -translate-y-1/2 z-10
                    bg-background border border-border shadow-md rounded px-2 py-1
                    text-sm font-medium whitespace-nowrap
                    transition-all duration-200 origin-left
                    ${hover ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
                `}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-20" />
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        {serverInfo?.name || id.substring(0, 6)}
                        {isRefreshing && <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />}
                        {hasUnread && (
                            <span className="flex items-center justify-center bg-red-500 text-white rounded-full text-xs min-w-4 h-4 px-1">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// Global variable to capture the install prompt event before component mounts
let deferredPromptEvent: any = null;

// Add global event listener to capture beforeinstallprompt
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPromptEvent = e;
        console.log('beforeinstallprompt event captured globally');
    });
}

export default function ServerList() {
    const {
        activeServerId,
        fetchServerInfo,
        fetchJoinedServers,
        serverListCache
    } = useGlobalState();
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [joinInput, setJoinInput] = useState("");
    const [serverName, setServerName] = useState("");
    const [serverIcon, setServerIcon] = useState<File | null>(null);
    const [fetchingJoinedServers, setFetchingJoinedServers] = useState(false);
    const [joinedServers, setJoinedServers] = useState<string[]>([]);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(deferredPromptEvent);
    const [isInstallable, setIsInstallable] = useState(!!deferredPromptEvent);
    const { address, wanderInstance, connectionStrategy } = useWallet();
    const navigate = useNavigate();

    useEffect(() => {
        // Listen for the beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later
            setDeferredPrompt(e);
            // Update UI to notify the user they can install the PWA
            setIsInstallable(true);
            console.log('beforeinstallprompt event detected in component');
        };

        // Check for globally captured event first
        if (deferredPromptEvent) {
            setDeferredPrompt(deferredPromptEvent);
            setIsInstallable(true);
            console.log('Using previously captured install prompt');
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if app is already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstallable(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    // Handle install button click
    const handleInstallClick = async () => {
        const promptEvent = deferredPrompt || deferredPromptEvent;

        if (!promptEvent) {
            console.log('No install prompt available');
            return;
        }

        // Show the installation prompt
        promptEvent.prompt();

        // Wait for the user to respond to the prompt
        try {
            const choiceResult = await promptEvent.userChoice;

            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                toast.success("App installed successfully!");
            } else {
                console.log('User dismissed the install prompt');
            }
        } catch (error) {
            console.error('Error with install prompt:', error);
        }

        // Clear the saved prompt since it can't be used again
        setDeferredPrompt(null);
        deferredPromptEvent = null;
        setIsInstallable(false);
    };

    // Fetch servers list when address changes or component mounts
    useEffect(() => {
        if (!address) return;
        runGetJoinedServers();
    }, [address]);

    // Check if we have cached data and use it immediately
    useEffect(() => {
        if (serverListCache && address && serverListCache.address === address) {
            // Use cached server list immediately to prevent flickering
            setJoinedServers(serverListCache.data);

            // Only show loading state if we don't have cached data
            if (serverListCache.data.length === 0) {
                setFetchingJoinedServers(true);
            } else {
                // If we have cached data, still refresh in the background
                const silentRefresh = async () => {
                    try {
                        // Force refresh only if the cache is older than 10 minutes
                        const cacheAge = Date.now() - serverListCache.timestamp;
                        const shouldForceRefresh = cacheAge > 10 * 60 * 1000;

                        // Silent background refresh
                        const servers = await fetchJoinedServers(address, shouldForceRefresh);
                        setJoinedServers(servers);
                    } catch (error) {
                        console.error("[ServerList] Error in silent refresh:", error);
                    }
                };

                // Wait a short delay before doing the background refresh
                setTimeout(silentRefresh, 2000);
            }
        }
    }, [serverListCache, address]);

    async function runGetJoinedServers() {
        if (!address) return;

        // Show loading state only if we don't have cached data
        if (!serverListCache || serverListCache.address !== address || serverListCache.data.length === 0) {
            setFetchingJoinedServers(true);
        }

        try {
            console.log("[ServerList] Fetching joined servers list");
            const res = await fetchJoinedServers(address, true); // Force refresh
            setJoinedServers(res);

            // After we have the servers list, start prefetching their data in the background
            for (const serverId of res) {
                // Queue up prefetching with a delay to avoid overwhelming API
                setTimeout(async () => {
                    try {
                        console.log(`[ServerList] Prefetching data for server: ${serverId}`);
                        await fetchServerInfo(serverId, true);
                    } catch (error) {
                        console.warn(`[ServerList] Failed to prefetch server ${serverId}:`, error);
                    }
                }, 500 * Math.random()); // Random delay for better distribution
            }
        } catch (error) {
            console.error("[ServerList] Error fetching joined servers:", error);
        } finally {
            setFetchingJoinedServers(false);
        }
    }

    async function runJoinServer() {
        if (!joinInput) return toast.error("Please enter a server ID or invite link.");

        // Extract server ID from invite link or use as is
        let serverId = joinInput.trim();

        // Handle invite links
        if (serverId.includes('/')) {
            const parts = serverId.split('/');
            serverId = parts[parts.length - 1].trim();
        }

        console.log("Joining server", serverId);

        try {
            // Try to fetch server info first to validate it exists
            toast.loading("Verifying server...");
            const serverInfo = await getServerInfo(serverId);

            // If server info fetch succeeded, join the server
            toast.dismiss();
            toast.loading("Joining server...");
            await joinServer(serverId);
            toast.dismiss();
            toast.success("Server joined successfully!");

            // Refresh joined servers list
            await runGetJoinedServers();

            // Update global state caches
            const globalState = useGlobalState.getState();

            // Update server cache with fetched data
            globalState.serverCache.set(serverId, {
                data: serverInfo,
                timestamp: Date.now()
            });

            // Force refresh server list in global state
            if (address) {
                // Update the server list cache
                const joinedServers = await fetchJoinedServers(address, true);
                setJoinedServers(joinedServers);
            }

            // Close dialog and navigate to the server
            setJoinDialogOpen(false);
            setJoinInput("");
            navigate(`/app/${serverId}`);
        } catch (error) {
            console.error("Error joining server:", error);
            toast.dismiss();
            toast.error("Invalid server ID or server not found");
        }
    }

    async function runCreateServer() {
        if (!serverName.trim()) {
            return toast.error("Please enter a server name");
        }

        // if (!serverIcon) {
        //     return toast.error("Please upload a server icon");
        // }

        try {
            toast.loading("Creating server... Don't close this window!");
            const serverId = await createServer(serverName, serverIcon);
            toast.dismiss();
            toast.success("Server created successfully!");

            // Refresh joined servers list
            await runGetJoinedServers();

            // Close dialog and navigate to the server
            setCreateDialogOpen(false);
            setServerName("");
            setServerIcon(null);
            navigate(`/app/${serverId}`);
        } catch (error) {
            console.error("Error creating server:", error);
            toast.dismiss();
            toast.error(error.message);
        }
    }

    async function openWallet() {
        wanderInstance.open()
    }

    return (
        <>
            <Button
                variant='outline'
                size='icon'
                data-active={activeServerId == null}
                className='w-10 h-10 rounded-lg transition-all duration-100 data-[active=true]:!bg-palette-lavender data-[active=true]:!text-black'
                onClick={() => navigate('/app')}
            >
                <Home />
            </Button>
            <TextWLine className='w-6 opacity-70' />
            {fetchingJoinedServers ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-12 rounded-lg" />
                    ))}
                </div>
            ) : (
                joinedServers.map((id) => (
                    <ServerIcon
                        key={id}
                        id={id}
                        refreshServerList={runGetJoinedServers}
                    />
                ))
            )}

            <div className="mt-auto" />

            {connectionStrategy === ConnectionStrategies.WanderConnect && <Button
                disabled={connectionStrategy !== ConnectionStrategies.WanderConnect}
                variant='outline'
                size='icon'
                className='w-10 h-10 rounded-lg hover:bg-primary/10 transition-colors'
                onClick={openWallet}
                title="Open Wallet"
            >
                <WalletCards className="h-5 w-5" />
            </Button>}

            {/* Install app button - only shown when installable */}
            {isInstallable && (
                <Button
                    variant='outline'
                    size='icon'
                    className='w-10 h-10 rounded-lg hover:bg-primary/10 transition-colors'
                    onClick={handleInstallClick}
                    title="Install App"
                >
                    <Download className="h-5 w-5" />
                </Button>
            )}

            {/* add server button */}
            <DropdownMenu>
                <DropdownMenuTrigger className="">
                    <Button variant='outline' size='icon' className='w-10 h-10 rounded-lg hover:bg-primary/10 transition-colors'>
                        <Plus className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56 p-2 space-y-1 relative left-4">
                    <DropdownMenuItem
                        onClick={() => {
                            setJoinInput("");
                            setJoinDialogOpen(true);
                        }}
                        className="cursor-pointer flex items-center gap-2 p-2 text-sm hover:bg-primary/10 rounded-md"
                    >
                        <Users className="h-4 w-4" />
                        <div>
                            <p className="font-medium">Join a Server</p>
                            <p className="text-xs text-muted-foreground">Join an existing server</p>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            setServerName("");
                            setServerIcon(null);
                            setCreateDialogOpen(true);
                        }}
                        className="cursor-pointer flex items-center gap-2 p-2 text-sm hover:bg-primary/10 rounded-md"
                    >
                        <PlusCircle className="h-4 w-4" />
                        <div>
                            <p className="font-medium">Create Your Own</p>
                            <p className="text-xs text-muted-foreground">Start a new server</p>
                        </div>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Moved AlertDialog outside of DropdownMenuItem */}
            <AlertDialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <AlertDialogContent className="w-full">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Join a Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter the server ID or invite link to join an existing server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-2 space-y-4">
                        <div className="">
                            <label htmlFor="join-input" className="text-sm font-medium text-foreground">
                                Server Invite
                            </label>
                            <div className="relative">
                                <Input
                                    id="join-input"
                                    placeholder="wLedDuEphwwvxLS-ftFb4mcXhqu4jwkYtIM4txCx2V8"
                                    value={joinInput}
                                    onChange={(e) => setJoinInput(e.target.value)}
                                    className="pl-9"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <Home className="h-4 w-4" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-md border border-border p-4 bg-muted/40">
                            <p className="text-sm font-medium mb-2">Sample Invites:</p>
                            <div className="grid gap-1">
                                {sampleInvites.map((invite) => (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start truncate h-8 px-2 text-muted-foreground hover:text-foreground transition-colors"
                                        key={invite}
                                        onClick={() => setJoinInput(invite)}
                                    >
                                        <code className="text-xs bg-muted/50 px-1 py-0.5 rounded font-mono truncate">
                                            {invite}
                                        </code>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={runJoinServer}
                            disabled={!joinInput.trim()}
                        >
                            Join
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create a Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Create your own server with a custom name and icon.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="flex gap-4 py-2">
                        <div className="w-1/3">
                            <FileDropzone
                                onFileChange={setServerIcon}
                                label="Server Icon"
                            />
                        </div>

                        <div className="flex-1 space-y-2">
                            <div className="space-y-2">
                                <label htmlFor="server-name" className="text-sm font-medium text-foreground">
                                    Server Name
                                </label>
                                <Input
                                    id="server-name"
                                    placeholder="My Awesome Server"
                                    value={serverName}
                                    onChange={(e) => setServerName(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={runCreateServer}>Create</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <div className="text-[10px] text-muted-foreground/60 p-0 -mb-1">
                {/* @ts-ignore */}
                v{__APP_VERSION__}
            </div>
        </>
    )
}