import { useGlobalState } from "@/hooks/global-state";
import { ChevronDown, Loader2, FolderPlus, MessageSquarePlus, Settings, Upload, X, CloudAlertIcon, ShieldAlertIcon, TrashIcon, HashIcon, ChevronRight, Link as LinkIcon, Pencil, MoreHorizontal } from "lucide-react";
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
import { updateServer, uploadFileAndGetId, createCategory, createChannel, updateCategory, deleteCategory, updateChannel, deleteChannel, runLua, leaveServer } from "@/lib/ao";
import { useWallet } from '@/hooks/use-wallet';
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import DraggableChannelList from "./draggable-channel-list";
import { useMobile } from "@/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { createContext, useContext } from 'react';
import { cleanupServerFromBrowserStorage } from "./server-list";

// @ts-ignore
const serverSource = `${__SERVER_SRC__}`

// Create a context to pass handlers to the DraggableChannelList component
type ChannelListContextType = {
    onEditCategory: (category: Category) => void;
    onDeleteCategory: (category: Category) => void;
    onEditChannel: (channel: Channel) => void;
    onDeleteChannel: (channel: Channel) => void;
};

const ChannelListContext = createContext<ChannelListContextType | undefined>(undefined);

export const useChannelListContext = () => {
    const context = useContext(ChannelListContext);
    if (!context) {
        throw new Error('useChannelListContext must be used within a ChannelListProvider');
    }
    return context;
};

export default function ChannelList() {
    const { activeServer, setActiveServer, activeServerId, activeChannelId } = useGlobalState();
    const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
    const [createChannelOpen, setCreateChannelOpen] = useState(false);
    const [updateServerOpen, setUpdateServerOpen] = useState(false);
    const [isUpdatingServer, setIsUpdatingServer] = useState(false);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [isCreatingChannel, setIsCreatingChannel] = useState(false);
    const [isLeavingServer, setIsLeavingServer] = useState(false);
    const [leaveServerOpen, setLeaveServerOpen] = useState(false);

    // New state variables for editing and deleting categories and channels
    const [editCategoryOpen, setEditCategoryOpen] = useState(false);
    const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);
    const [editChannelOpen, setEditChannelOpen] = useState(false);
    const [deleteChannelOpen, setDeleteChannelOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [isDeletingCategory, setIsDeletingCategory] = useState(false);
    const [isEditingChannel, setIsEditingChannel] = useState(false);
    const [isDeletingChannel, setIsDeletingChannel] = useState(false);
    const [editCategoryName, setEditCategoryName] = useState("");
    const [editChannelName, setEditChannelName] = useState("");

    const { address: activeAddress } = useWallet();
    const isMobile = useMobile();
    const navigate = useNavigate();
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

    // Initialize category edit dialog when opened
    useEffect(() => {
        if (editCategoryOpen && selectedCategory) {
            setEditCategoryName(selectedCategory.name);
        }
    }, [editCategoryOpen, selectedCategory]);

    // Initialize channel edit dialog when opened
    useEffect(() => {
        if (editChannelOpen && selectedChannel) {
            setEditChannelName(selectedChannel.name);
        }
    }, [editChannelOpen, selectedChannel]);

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
            const result = await createCategory(activeServerId, categoryName.trim()) as Category;
            toast.dismiss();
            toast.success("Category created successfully");

            // Update global state with new category
            if (activeServer && result) {
                const updatedServer: Server = {
                    ...activeServer,
                    categories: [...activeServer.categories, result]
                };
                setActiveServer(updatedServer);
            }

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
            const result = await createChannel(activeServerId, channelName.trim()) as Channel;
            toast.dismiss();
            toast.success("Channel created successfully");

            // Update global state with new channel
            if (activeServer && result) {
                const updatedServer: Server = {
                    ...activeServer,
                    channels: [...activeServer.channels, result]
                };
                setActiveServer(updatedServer);
            }

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
            await runLua(serverSource, activeServerId, [{ name: "Subspace-Chat-Function", value: "Update-Server-Code" }])
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

        setLeaveServerOpen(true);
    }

    const confirmLeaveServer = async () => {
        if (!activeServerId) {
            return toast.error("No active server selected");
        }

        setIsLeavingServer(true);

        try {
            toast.loading("Leaving server...");
            await leaveServer(activeServerId);
            toast.dismiss();
            toast.success("Server left successfully");

            // Get global state to update caches
            const globalState = useGlobalState.getState();

            // Remove the server from the server cache
            globalState.serverCache.delete(activeServerId);

            // Clean up browser storage for this server
            cleanupServerFromBrowserStorage(activeServerId);

            // Force refresh the joined servers list in global state
            if (activeAddress) {
                try {
                    // Force refresh the server list
                    await globalState.fetchJoinedServers(activeAddress, true);
                } catch (error) {
                    console.error("Error refreshing server list after leave:", error);
                }
            }

            // Reset active server in global state
            globalState.setActiveServer(null);
            globalState.setActiveServerId(null);
            globalState.setActiveChannelId(null);

            // Navigate to home page
            navigate('/app');
        } catch (error) {
            console.error("Error leaving server:", error);
            toast.dismiss();
            toast.error(error instanceof Error ? error.message : "Failed to leave server");
        } finally {
            setIsLeavingServer(false);
            setLeaveServerOpen(false);
        }
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

    // Add new handler functions for editing and deleting categories and channels
    const handleEditCategory = async () => {
        if (!activeServerId || !selectedCategory) {
            return toast.error("No category selected");
        }

        if (!editCategoryName.trim()) {
            return toast.error("Please enter a category name");
        }

        setIsEditingCategory(true);

        try {
            toast.loading("Updating category...");
            const result = await updateCategory(activeServerId, selectedCategory.id, editCategoryName.trim()) as Category;
            toast.dismiss();
            toast.success("Category updated successfully");

            // Update global state with updated category
            if (activeServer && result) {
                const updatedServer: Server = {
                    ...activeServer,
                    categories: activeServer.categories.map(cat =>
                        cat.id === selectedCategory.id ? result : cat
                    )
                };
                setActiveServer(updatedServer);
            }

            setEditCategoryName("");
            setEditCategoryOpen(false);
            setSelectedCategory(null);
        } catch (error) {
            console.error("Error updating category:", error);
            toast.error(error instanceof Error ? error.message : "Failed to update category");
        } finally {
            setIsEditingCategory(false);
        }
    };

    const handleDeleteCategory = async () => {
        if (!activeServerId || !selectedCategory) {
            return toast.error("No category selected");
        }

        setIsDeletingCategory(true);

        try {
            toast.loading("Deleting category...");
            await deleteCategory(activeServerId, selectedCategory.id);
            toast.dismiss();
            toast.success("Category deleted successfully");

            // Update global state by removing the category
            if (activeServer) {
                const updatedServer: Server = {
                    ...activeServer,
                    categories: activeServer.categories.filter(cat => cat.id !== selectedCategory.id)
                };
                setActiveServer(updatedServer);
            }

            setDeleteCategoryOpen(false);
            setSelectedCategory(null);
        } catch (error) {
            console.error("Error deleting category:", error);
            toast.error(error instanceof Error ? error.message : "Failed to delete category");
        } finally {
            setIsDeletingCategory(false);
        }
    };

    const handleEditChannel = async () => {
        if (!activeServerId || !selectedChannel) {
            return toast.error("No channel selected");
        }

        if (!editChannelName.trim()) {
            return toast.error("Please enter a channel name");
        }

        setIsEditingChannel(true);

        try {
            toast.loading("Updating channel...");
            const result = await updateChannel(activeServerId, selectedChannel.id, editChannelName.trim()) as Channel;
            toast.dismiss();
            toast.success("Channel updated successfully");

            // Update global state with updated channel
            if (activeServer && result) {
                const updatedServer: Server = {
                    ...activeServer,
                    channels: activeServer.channels.map(ch =>
                        ch.id === selectedChannel.id ? result : ch
                    )
                };
                setActiveServer(updatedServer);
            }

            setEditChannelName("");
            setEditChannelOpen(false);
            setSelectedChannel(null);
        } catch (error) {
            console.error("Error updating channel:", error);
            toast.error(error instanceof Error ? error.message : "Failed to update channel");
        } finally {
            setIsEditingChannel(false);
        }
    };

    const handleDeleteChannel = async () => {
        if (!activeServerId || !selectedChannel) {
            return toast.error("No channel selected");
        }

        setIsDeletingChannel(true);

        try {
            toast.loading("Deleting channel...");
            await deleteChannel(activeServerId, selectedChannel.id);
            toast.dismiss();
            toast.success("Channel deleted successfully");

            // Update global state by removing the channel
            if (activeServer) {
                const updatedServer: Server = {
                    ...activeServer,
                    channels: activeServer.channels.filter(ch => ch.id !== selectedChannel.id)
                };
                setActiveServer(updatedServer);
            }

            setDeleteChannelOpen(false);
            setSelectedChannel(null);
        } catch (error) {
            console.error("Error deleting channel:", error);
            toast.error(error instanceof Error ? error.message : "Failed to delete channel");
        } finally {
            setIsDeletingChannel(false);
        }
    };

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
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4" />
                        </div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="pl-4 space-y-1">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-11/12" />
                            </div>
                        ))}
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-4" />
                        </div>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="pl-4">
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ))}
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

                        {/* Pass edit/delete handlers to DraggableChannelList via context */}
                        <ChannelListContext.Provider value={{
                            onEditCategory: (category) => {
                                setSelectedCategory(category);
                                setEditCategoryOpen(true);
                            },
                            onDeleteCategory: (category) => {
                                setSelectedCategory(category);
                                setDeleteCategoryOpen(true);
                            },
                            onEditChannel: (channel) => {
                                setSelectedChannel(channel);
                                setEditChannelOpen(true);
                            },
                            onDeleteChannel: (channel) => {
                                setSelectedChannel(channel);
                                setDeleteChannelOpen(true);
                            }
                        }}>
                            <DraggableChannelList />
                        </ChannelListContext.Provider>
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
                            <FileDropzone
                                onFileChange={setServerIcon}
                                label="Server Icon"
                                currentFile={activeServer?.icon}
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

            {/* Edit Category Dialog */}
            <AlertDialog open={editCategoryOpen} onOpenChange={setEditCategoryOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Edit Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Update the category name.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <label htmlFor="edit-category-name" className="text-sm font-medium text-foreground">
                                Category Name
                            </label>
                            <Input
                                id="edit-category-name"
                                placeholder="e.g. General Discussion"
                                value={editCategoryName}
                                onChange={(e) => setEditCategoryName(e.target.value)}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isEditingCategory}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleEditCategory}
                            disabled={isEditingCategory}
                            className="relative"
                        >
                            {isEditingCategory ? (
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

            {/* Delete Category Dialog */}
            <AlertDialog open={deleteCategoryOpen} onOpenChange={setDeleteCategoryOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this category? All channels in this category will become uncategorized.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCategory}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCategory}
                            disabled={isDeletingCategory}
                            className="relative bg-destructive hover:bg-destructive/90"
                        >
                            {isDeletingCategory ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Channel Dialog */}
            <AlertDialog open={editChannelOpen} onOpenChange={setEditChannelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Edit Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                            Update the channel name.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <label htmlFor="edit-channel-name" className="text-sm font-medium text-foreground">
                                Channel Name
                            </label>
                            <Input
                                id="edit-channel-name"
                                placeholder="e.g. general"
                                value={editChannelName}
                                onChange={(e) => setEditChannelName(e.target.value)}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isEditingChannel}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleEditChannel}
                            disabled={isEditingChannel}
                            className="relative"
                        >
                            {isEditingChannel ? (
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

            {/* Delete Channel Dialog */}
            <AlertDialog open={deleteChannelOpen} onOpenChange={setDeleteChannelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this channel? All messages will be permanently lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingChannel}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteChannel}
                            disabled={isDeletingChannel}
                            className="relative bg-destructive hover:bg-destructive/90"
                        >
                            {isDeletingChannel ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Leave Server Dialog */}
            <AlertDialog open={leaveServerOpen} onOpenChange={setLeaveServerOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to leave this server? You'll need a new invite to join again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLeavingServer}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmLeaveServer}
                            disabled={isLeavingServer}
                            className="relative bg-destructive hover:bg-destructive/90"
                        >
                            {isLeavingServer ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Leaving...
                                </>
                            ) : (
                                "Leave Server"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}