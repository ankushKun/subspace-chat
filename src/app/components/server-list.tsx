import { Plus, Upload, File, X, Home, Users, PlusCircle, Loader2, ShieldAlertIcon, Trash2 } from "lucide-react"
import type { Server } from "@/lib/types"

import { Button } from "@/components/ui/button";
import { useGlobalState } from "@/hooks/global-state";
import { useState, useCallback, useEffect, useMemo } from "react";
import TextWLine from "@/components/text-w-line";
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

import { createServer, getJoinedServers, getServerInfo, joinServer, leaveServer } from "@/lib/ao";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as Progress from "@radix-ui/react-progress";
import { useActiveAddress } from "@arweave-wallet-kit/react";
import { useNavigate } from "react-router-dom";

const sampleInvites = [
    "abcxyz",
    "https://subspace.ar.io/#/join/abcxyz",
    "https://join_subspace.ar.io/abcxyz",
]

const ServerIcon = ({ id, refreshServerList }: { id: string, refreshServerList: () => void }) => {
    const navigate = useNavigate();
    const {
        activeServerId,
        activeServer,
        isLoadingServer,
        serverCache,
        refreshingServers,
        isServerValid
    } = useGlobalState();
    const [hover, setHover] = useState(false);
    const [isLeavingServer, setIsLeavingServer] = useState(false);
    const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

    const isInvalid = !isServerValid(id);
    const isActive = activeServerId === id;

    const handleMouseEnter = () => setHover(true);
    const handleMouseLeave = () => setHover(false);

    function clicked() {
        if (!isInvalid) {
            navigate(`/app/${id}`);
            setHover(false);
        }
    }

    async function handleLeaveServer() {
        try {
            setIsLeavingServer(true);
            await leaveServer(id);
            toast.success("Server removed successfully");

            // Refresh the server list
            refreshServerList();
            navigate('/app');
        } catch (error) {
            console.error("Error leaving server:", error);
            toast.error("Failed to leave server");
        } finally {
            setIsLeavingServer(false);
            setConfirmLeaveOpen(false);
        }
    }

    // Get server info from the global state or cache, but only if not invalid
    const cachedData = !isInvalid ? serverCache.get(id) : null;

    // Important: Only use activeServer data if this specific server is active
    // This prevents carrying over data from previous servers
    const serverInfo = !isInvalid && isActive ? activeServer :
        (cachedData ? cachedData.data : null);

    // Determine if we're loading this specific server
    const isLoading = !isInvalid && isActive && isLoadingServer;

    // Only show refreshing indicator if this specific server is being refreshed
    const isRefreshing = !isInvalid && refreshingServers.has(id);

    // Determine if we have valid server data to display
    const hasServerData = !isInvalid && serverInfo && serverInfo.icon;

    return (
        <div className="relative group">
            <Button
                className={`w-12 h-12 p-0 rounded-lg relative ${isInvalid ? 'opacity-80 grayscale' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={clicked}
            >
                <div
                    data-visible={hover || isActive}
                    data-expand={isActive}
                    className='w-[2px] absolute -left-2 z-10 bg-foreground rounded-r transition-all duration-100 h-2 data-[expand=true]:h-6 data-[visible=true]:opacity-100 data-[visible=false]:opacity-0'
                />

                {/* Invalid server display */}
                {isInvalid && (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
                        <ShieldAlertIcon className="w-6 h-6 text-destructive" />
                    </div>
                )}

                {/* Loading state */}
                {!isInvalid && isLoading && (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* Server with data */}
                {!isInvalid && !isLoading && hasServerData && (
                    <img
                        src={`https://arweave.net/${serverInfo.icon}`}
                        className='w-full h-full object-cover rounded-lg'
                        alt={serverInfo?.name || id}
                    />
                )}

                {/* Default placeholder when not loading but no data yet */}
                {!isInvalid && !isLoading && !hasServerData && (
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

                {isInvalid && (
                    <div
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            setConfirmLeaveOpen(true);
                        }}
                    >
                        <Trash2 className="w-3 h-3 text-white" />
                    </div>
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : isInvalid ? (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-destructive">
                            <ShieldAlertIcon className="h-3 w-3" />
                            <span>Invalid Server</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            ID: {id.substring(0, 6)}...
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        {serverInfo?.name || id.substring(0, 6)}
                        {isRefreshing && <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />}
                    </div>
                )}
            </div>

            {/* Confirm Leave Dialog */}
            <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            This server appears to be invalid or no longer accessible. Would you like to remove it from your server list?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLeavingServer}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLeaveServer}
                            disabled={isLeavingServer}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isLeavingServer ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                "Remove Server"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

// File dropzone component
const FileDropzone = ({
    onFileChange
}: {
    onFileChange: (file: File | null) => void
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    // 100KB size limit in bytes
    const MAX_FILE_SIZE = 100 * 1024;

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
        // Clear previous errors
        setFileError(null);

        // Handle file rejections (e.g., file size, type)
        if (fileRejections.length > 0) {
            const { code, message } = fileRejections[0].errors[0];
            if (code === 'file-too-large') {
                setFileError(`File is too large. Maximum size is 100KB.`);
            } else {
                setFileError(message);
            }
            return;
        }

        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setSelectedFile(file);
            onFileChange(file);

            // Create preview for image
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }, [onFileChange]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif']
        },
        maxFiles: 1,
        maxSize: MAX_FILE_SIZE,
    });

    const removeFile = () => {
        setSelectedFile(null);
        setPreview(null);
        setFileError(null);
        onFileChange(null);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="w-full space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground">Server Icon</label>
                <span className="text-xs text-muted-foreground">Max 100KB</span>
            </div>

            {!selectedFile ? (
                <div
                    {...getRootProps()}
                    className={`
                        border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer
                        flex flex-col items-center justify-center min-h-[120px]
                        ${isDragActive
                            ? 'border-primary bg-primary/5'
                            : fileError
                                ? 'border-destructive/50 bg-destructive/5'
                                : 'border-muted-foreground/20 hover:border-muted-foreground/50'
                        }
                    `}
                >
                    <input {...getInputProps()} />
                    <Upload className={`h-6 w-6 mb-2 ${fileError ? 'text-destructive' : 'text-muted-foreground'}`} />

                    {fileError ? (
                        <div className="text-center">
                            <p className="text-sm text-destructive font-medium">{fileError}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Try a smaller image (maximum 100KB)
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-center text-muted-foreground">
                            {isDragActive ? 'Drop your image here' : 'Drag & drop server icon or click to select'}
                        </p>
                    )}
                </div>
            ) : (
                <div className="relative bg-muted rounded-lg p-1">
                    <div className="relative aspect-square w-full overflow-hidden rounded-md">
                        {preview && (
                            <img
                                src={preview}
                                alt="Preview"
                                className="h-full w-full object-cover"
                            />
                        )}
                    </div>
                    {selectedFile && (
                        <div className="absolute bottom-2 left-2 text-xs bg-black/70 text-white px-2 py-1 rounded-md">
                            {formatFileSize(selectedFile.size)}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={removeFile}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-xs text-white shadow-sm"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default function ServerList() {
    const { activeServerId, isServerValid } = useGlobalState();
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [joinInput, setJoinInput] = useState("");
    const [serverName, setServerName] = useState("");
    const [serverIcon, setServerIcon] = useState<File | null>(null);
    const [fetchingJoinedServers, setFetchingJoinedServers] = useState(false);
    const [joinedServers, setJoinedServers] = useState<string[]>([]);
    const address = useActiveAddress();
    const navigate = useNavigate();

    useEffect(() => {
        console.log("address", address);
        if (!address) return
        runGetJoinedServers();
    }, [address]);

    async function runGetJoinedServers() {
        if (!address) return;
        setFetchingJoinedServers(true);
        const res = await getJoinedServers(address);
        setJoinedServers(res);
        setFetchingJoinedServers(false);
    }

    async function runJoinServer() {
        if (!joinInput) return toast.error("Please enter a server ID or invite link.");

        // Extract server ID from invite link or use as is
        let serverId = joinInput.trim();

        // Handle invite links
        if (serverId.includes('/')) {
            const parts = serverId.split('/');
            serverId = parts[parts.length - 1];
        }

        console.log("Joining server", serverId);

        try {
            // Try to fetch server info first to validate it exists
            toast.loading("Verifying server...");
            await getServerInfo(serverId);

            // If server info fetch succeeded, join the server
            toast.dismiss();
            toast.loading("Joining server...");
            await joinServer(serverId);
            toast.dismiss();
            toast.success("Server joined successfully!");

            // Refresh joined servers list
            await runGetJoinedServers();

            // Close dialog and navigate to the server
            setJoinDialogOpen(false);
            setJoinInput("");
            navigate(`/app/${serverId}`);
        } catch (error) {
            console.error("Error joining server:", error);
            toast.dismiss();

            // Mark as invalid in global state
            useGlobalState.getState().markServerAsInvalid(serverId);

            toast.error("Invalid server ID or server not found");
        }
    }

    async function runCreateServer() {
        if (!serverName.trim()) {
            return toast.error("Please enter a server name");
        }

        if (!serverIcon) {
            return toast.error("Please upload a server icon");
        }

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
            toast.error(error instanceof Error ? error.message : "Failed to create server");
        }
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
                <Loader2 className="h-12 w-12 p-3 animate-spin" />
            ) : (
                joinedServers.map((id) => (
                    <ServerIcon
                        key={id}
                        id={id}
                        refreshServerList={runGetJoinedServers}
                    />
                ))
            )}
            {/* add server button */}
            <DropdownMenu>
                <DropdownMenuTrigger className="mt-auto">
                    <Button variant='outline' size='icon' className='w-10 h-10 rounded-lg mt-auto hover:bg-primary/10 transition-colors'>
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
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Join a Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter the server ID or invite link to join an existing server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-2 space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="join-input" className="text-sm font-medium text-foreground">
                                Server Invite
                            </label>
                            <div className="relative">
                                <Input
                                    id="join-input"
                                    placeholder="https://subspace.ar.io/#/join/abcxyz"
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
                                        className="justify-start h-8 px-2 text-muted-foreground hover:text-foreground transition-colors"
                                        key={invite}
                                        onClick={() => setJoinInput(invite)}
                                    >
                                        <code className="text-xs bg-muted/50 px-1 py-0.5 rounded font-mono">
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
                            <FileDropzone onFileChange={setServerIcon} />
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
            </AlertDialog >
        </>
    )
}