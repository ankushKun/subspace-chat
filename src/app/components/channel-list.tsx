import { useGlobalState } from "@/hooks/global-state";
import { ChevronDown, Loader2, FolderPlus, MessageSquarePlus, Settings, Upload, X, CloudAlertIcon, ShieldAlertIcon, TrashIcon, HashIcon, ChevronRight, Link as LinkIcon } from "lucide-react";
import type { Server, Category, Channel } from "@/lib/types";
import { useState, useCallback, useEffect, useMemo } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { updateServer, uploadFileAndGetId, createCategory, createChannel, runLua } from "@/lib/ao";
import { useActiveAddress } from "@arweave-wallet-kit/react";
import serverCode from "@/lib/lua/server";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import DraggableChannelList from "./draggable-channel-list";
import { useMobile } from "@/hooks";

// File dropzone component for server icon
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

export default function ChannelList() {
    const { activeServer, setActiveServer, activeServerId, activeChannelId } = useGlobalState();
    const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
    const [createChannelOpen, setCreateChannelOpen] = useState(false);
    const [updateServerOpen, setUpdateServerOpen] = useState(false);
    const [isUpdatingServer, setIsUpdatingServer] = useState(false);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [isCreatingChannel, setIsCreatingChannel] = useState(false);
    const activeAddress = useActiveAddress();
    const isMobile = useMobile();
    // Form states
    const [categoryName, setCategoryName] = useState("");
    const [channelName, setChannelName] = useState("");
    const [serverName, setServerName] = useState("");
    const [serverIcon, setServerIcon] = useState<File | null>(null);

    // Check if current user is server owner
    const isServerOwner = activeServer?.owner === activeAddress;

    // Initialize server name when dialog opens
    useEffect(() => {
        if (updateServerOpen && activeServer) {
            setServerName(activeServer.name);
        }
    }, [updateServerOpen, activeServer]);

    const handleCreateCategory = async () => {
        if (!activeServerId) {
            return toast.error("No active server selected");
        }

        if (!categoryName.trim()) {
            return toast.error("Please enter a category name");
        }

        setIsCreatingCategory(true);

        try {
            toast.loading("Creating category...");
            // Let the backend place it at the end (default behavior)
            await createCategory(activeServerId, categoryName.trim());
            toast.dismiss();
            toast.success("Category created successfully");

            setCategoryName("");
            setCreateCategoryOpen(false);
        } catch (error) {
            console.error("Error creating category:", error);
            toast.error(error instanceof Error ? error.message : "Failed to create category");
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const handleCreateChannel = async () => {
        if (!activeServerId) {
            return toast.error("No active server selected");
        }

        if (!channelName.trim()) {
            return toast.error("Please enter a channel name");
        }

        setIsCreatingChannel(true);

        try {
            toast.loading("Creating channel...");
            await createChannel(activeServerId, channelName.trim());
            toast.dismiss();
            toast.success("Channel created successfully");

            setChannelName("");
            setCreateChannelOpen(false);
        } catch (error) {
            console.error("Error creating channel:", error);
            toast.error(error instanceof Error ? error.message : "Failed to create channel");
        } finally {
            setIsCreatingChannel(false);
        }
    };

    const handleUpdateServer = async () => {
        if (!activeServer) {
            return toast.error("No active server selected");
        }

        if (!serverName.trim()) {
            return toast.error("Please enter a server name");
        }

        if (!activeServerId) {
            return toast.error("No server ID found");
        }

        // Validate file size if a new icon is selected
        if (serverIcon && serverIcon.size > 100 * 1024) {
            return toast.error("Server icon must be less than 100KB");
        }

        setIsUpdatingServer(true);

        try {
            // Start with the current icon ID
            let iconId = activeServer.icon || "";

            // Upload new icon if selected
            if (serverIcon) {
                toast.loading("Uploading server icon...");
                try {
                    const uploadedIconId = await uploadFileAndGetId(serverIcon);
                    if (uploadedIconId) {
                        iconId = uploadedIconId;
                        toast.dismiss();
                    } else {
                        toast.dismiss();
                        toast.error("Failed to get icon ID after upload");
                        setIsUpdatingServer(false);
                        return;
                    }
                } catch (error) {
                    console.error("Error uploading icon:", error);
                    toast.dismiss();
                    toast.error("Failed to upload server icon");
                    setIsUpdatingServer(false);
                    return;
                }
            }

            // Ensure icon is a non-empty string
            if (!iconId) {
                iconId = ""; // Provide empty string as default
            }

            toast.loading("Updating server details... don't close this window");
            const result = await updateServer(activeServerId, serverName, iconId);
            toast.dismiss();

            if (result) {
                // Update local state to reflect changes
                setActiveServer({
                    ...activeServer,
                    name: serverName,
                    icon: iconId
                });
                toast.success("Server details updated successfully");
            }

            setServerName("");
            setServerIcon(null);
            setUpdateServerOpen(false);
        } catch (error) {
            console.error("Error updating server:", error);
            toast.dismiss();
            toast.error(error instanceof Error ? error.message : "Failed to update server details");
        } finally {
            setIsUpdatingServer(false);
        }
    };

    const handleUpdateServerProcessCode = async () => {
        if (!activeServerId) {
            return toast.error("No active server selected");
        }

        async function updateServerProcessCode() {
            await runLua(serverCode, activeServerId, [{ name: "Subspace-Chat-Function", value: "Update-Server-Code" }])
        }

        // toast that has a button to confirm if user wants to update the server process code
        toast.custom((t) => (
            <div className="flex items-center gap-4 bg-accent border border-border backdrop-blur-sm p-4 rounded-lg">
                <ShieldAlertIcon className="w-5 h-5" />
                <div className="flex-1">
                    <p className="font-medium">Update Server Process Code</p>
                    <p className="text-sm text-muted-foreground">Are you sure you want to proceed? This could break server code</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Button size="sm" onClick={() => {
                        toast.dismiss(t)
                        toast.promise(updateServerProcessCode(), {
                            loading: "Updating server process code...",
                            success: "Server process code updated successfully",
                            error: "Failed to update server process code"
                        })
                    }}>Update</Button>
                    <Button variant="ghost" size="sm" onClick={() => toast.dismiss(t)}>Cancel</Button>
                </div>
            </div>
        ))


    };

    const handleServerDelete = async () => {
        if (!activeServerId) {
            return toast.error("No active server selected");
        }

        toast.info("TODO: Delete server")
    }

    const handleServerLeave = async () => {
        if (!activeServerId) {
            return toast.error("No active server selected");
        }

        toast.info("TODO: Leave server")
    }

    // Organize channels by categories in a clean, performant way
    const { categories, categorizedChannels, uncategorizedChannels } = useMemo(() => {
        if (!activeServer) {
            return { categories: [], categorizedChannels: new Map(), uncategorizedChannels: [] };
        }

        // 1. Sort categories by their display order
        const sortedCategories = [...activeServer.categories].sort((a, b) => a.order_id - b.order_id);

        // 2. Create a set of valid category IDs for efficient lookups
        const categoryIds = new Set(sortedCategories.map(cat => cat.id));

        // 3. Initialize the map of categories to their channels
        const channelsByCategory = new Map<number, Channel[]>();

        // 4. First pass: categorize channels into their respective categories
        for (const channel of activeServer.channels) {
            const catId = channel.category_id;

            // Skip channels without category assignments
            if (catId === null || catId === undefined) {
                continue;
            }

            // Ensure consistent ID type (handle string vs number)
            const categoryId = typeof catId === 'string' ? parseInt(catId, 10) : catId;

            // Only categorize if the category actually exists
            if (categoryIds.has(categoryId)) {
                if (!channelsByCategory.has(categoryId)) {
                    channelsByCategory.set(categoryId, []);
                }
                channelsByCategory.get(categoryId)?.push(channel);
            }
        }

        // 5. Sort channels within each category by their display order
        for (const [categoryId, channels] of channelsByCategory.entries()) {
            channelsByCategory.set(
                categoryId,
                channels.sort((a, b) => a.order_id - b.order_id)
            );
        }

        // 6. Identify channels that don't belong to a valid category
        const uncategorized = activeServer.channels
            .filter(channel => {
                const catId = channel.category_id;

                // Channel is uncategorized if it has no category or its category doesn't exist
                if (catId === null || catId === undefined) return true;

                const categoryId = typeof catId === 'string' ? parseInt(catId, 10) : catId;
                return !categoryIds.has(categoryId);
            })
            .sort((a, b) => a.order_id - b.order_id);

        return {
            categories: sortedCategories,
            categorizedChannels: channelsByCategory,
            uncategorizedChannels: uncategorized
        };
    }, [activeServer]);

    // Track which categories are expanded (default all expanded)
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

    // Toggle category expansion when clicked
    const toggleCategory = (categoryId: number) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };

    // Ensure all categories are expanded by default when server changes
    useEffect(() => {
        if (activeServer?.categories) {
            setExpandedCategories(new Set(activeServer.categories.map(cat => cat.id)));
        }
    }, [activeServer?.categories]);

    return (
        <div className="relative w-full flex flex-col h-full">
            <DropdownMenu>
                <DropdownMenuTrigger asChild className="w-full">
                    <div className='w-full select-none border-b border-border/70 hover:bg-accent/40 rounded-t-lg p-3 px-4 flex items-center justify-between cursor-pointer'>
                        <div>{activeServer?.name || <Loader2 className='w-4 h-4 animate-spin' />}</div>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    data-mobile={isMobile}
                    className="p-2 data-[mobile=true]:!w-[calc(100vw-88px)] data-[mobile=false]:!min-w-[333px]  space-y-1 bg-background/95 backdrop-blur-sm"
                    sideOffset={4}
                >
                    {/* Copy Invite available to all users */}
                    <DropdownMenuItem
                        onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/#/invite/${activeServerId}`)
                            toast.success("Invite link copied to clipboard")
                        }}
                        className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                    >
                        <LinkIcon className="h-5 w-5" />
                        <div>
                            <p className="font-medium">Copy Invite</p>
                            <p className="text-xs text-muted-foreground">Use this link to invite others to the server</p>
                        </div>
                    </DropdownMenuItem>

                    {isServerOwner && (
                        <>
                            <DropdownMenuItem
                                onClick={() => setCreateCategoryOpen(true)}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                            >
                                <FolderPlus className="h-5 w-5" />
                                <div>
                                    <p className="font-medium">Create Category</p>
                                    <p className="text-xs text-muted-foreground">Add a new category</p>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setCreateChannelOpen(true)}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                            >
                                <MessageSquarePlus className="h-5 w-5" />
                                <div>
                                    <p className="font-medium">Create Channel</p>
                                    <p className="text-xs text-muted-foreground">Add a new channel</p>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setUpdateServerOpen(true)}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                            >
                                <Settings className="h-5 w-5" />
                                <div>
                                    <p className="font-medium">Update Server Details</p>
                                    <p className="text-xs text-muted-foreground">Edit name and icon</p>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleUpdateServerProcessCode}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                            >
                                <CloudAlertIcon className="h-5 w-5" />
                                <div>
                                    <p className="font-medium">Update Server Process Code</p>
                                    <p className="text-xs text-muted-foreground">Update server code to latest version</p>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleServerDelete}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                            >
                                <TrashIcon className="h-5 w-5" />
                                <div>
                                    <p className="font-medium">Delete Server</p>
                                    <p className="text-xs text-muted-foreground">Delete this server</p>
                                </div>
                            </DropdownMenuItem>
                        </>
                    )}
                    {!isServerOwner && (
                        <DropdownMenuItem
                            onClick={handleServerLeave}
                            className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                        >
                            <TrashIcon className="h-5 w-5" />
                            <div>
                                <p className="font-medium">Leave Server</p>
                                <p className="text-xs text-muted-foreground">Leave this server</p>
                            </div>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Channel List Content */}
            <div className="flex-1 overflow-y-auto py-2">
                {!activeServer ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Development-only debug info */}
                        {process.env.NODE_ENV === 'development' && (
                            <div className="p-2 text-xs border border-yellow-500 rounded mb-2 bg-yellow-500/10">
                                <details>
                                    <summary className="cursor-pointer font-mono">Debug Info</summary>
                                    <pre className="mt-2 overflow-auto max-h-[200px]">
                                        {JSON.stringify({
                                            channels: activeServer.channels.length,
                                            categories: activeServer.categories.length,
                                            activeChannelId: activeChannelId
                                        }, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        )}

                        {/* Use the draggable channel list component instead */}
                        <DraggableChannelList />
                    </div>
                )}
            </div>

            {/* Create Category Dialog */}
            <AlertDialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Add a new category to organize your channels.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <label htmlFor="category-name" className="text-sm font-medium text-foreground">
                                Category Name
                            </label>
                            <Input
                                id="category-name"
                                placeholder="e.g. General Discussion"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCreatingCategory}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCreateCategory}
                            disabled={isCreatingCategory}
                            className="relative"
                        >
                            {isCreatingCategory ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Channel Dialog */}
            <AlertDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                            Add a new channel to communicate with others.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <label htmlFor="channel-name" className="text-sm font-medium text-foreground">
                                Channel Name
                            </label>
                            <Input
                                id="channel-name"
                                placeholder="e.g. general"
                                value={channelName}
                                onChange={(e) => setChannelName(e.target.value)}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCreatingChannel}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCreateChannel}
                            disabled={isCreatingChannel}
                            className="relative"
                        >
                            {isCreatingChannel ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Update Server Dialog */}
            <AlertDialog open={updateServerOpen} onOpenChange={setUpdateServerOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Update Server Details</AlertDialogTitle>
                        <AlertDialogDescription>
                            Edit your server's name and icon.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="flex gap-4 py-4">
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
                        <AlertDialogCancel disabled={isUpdatingServer}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUpdateServer}
                            disabled={isUpdatingServer}
                            className="relative"
                        >
                            {isUpdatingServer ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                "Update"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Category Header Component
function CategoryHeader({
    category,
    isExpanded,
    onToggle
}: {
    category: Category;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-2 py-1 text-xs uppercase font-semibold text-muted-foreground hover:text-foreground group transition-colors"
        >
            <div className="flex items-center gap-1">
                <ChevronRight
                    className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
                <span>{category.name}</span>
            </div>
        </button>
    );
}

// Channel Item Component
function ChannelItem({ channel }: { channel: Channel }) {
    const navigate = useNavigate();
    const { activeServerId, activeChannelId, setActiveChannelId } = useGlobalState();

    // Check if this channel is the active one
    const isActive = activeChannelId === channel.id;

    const handleChannelClick = () => {
        // Update global state
        setActiveChannelId(channel.id);
        // Navigate to the channel
        navigate(`/app/${activeServerId}/${channel.id}`);
    };

    return (
        <div
            className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer group transition-colors
                ${isActive
                    ? 'bg-primary/20 text-foreground'
                    : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'}`
            }
            onClick={handleChannelClick}
        >
            <HashIcon className="h-4 w-4" />
            <span className="text-sm font-medium truncate">{channel.name}</span>
        </div>
    );
}