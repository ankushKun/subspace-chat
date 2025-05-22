import { useState, useEffect, useRef } from 'react';
// TODO: Replace react-beautiful-dnd with framer-motion's drag functionality
// Example: import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
// For implementation details, see: https://www.framer.com/motion/examples/#drag-to-reorder
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useGlobalState } from '@/hooks/global-state';
import { HashIcon, ChevronRight, Loader2, Plus, RefreshCw, Pencil, TrashIcon } from 'lucide-react';
import type { Channel, Category } from '@/lib/types';
import { useNavigate } from 'react-router-dom';
import { updateChannel, updateCategory, createChannel, refreshCurrentServerData, markNotificationsAsRead } from '@/lib/ao';
import { toast } from 'sonner';
import { useWallet } from '@/hooks/use-wallet';
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
import { Button } from "@/components/ui/button";
import { useChannelListContext } from './channel-list';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

export default function DraggableChannelList() {
    const {
        activeServer,
        activeServerId,
        activeChannelId,
        setActiveChannelId,
        refreshServerData,
        hasUnreadNotifications,
        getUnreadCount
    } = useGlobalState();
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const navigate = useNavigate();
    const { address: activeAddress } = useWallet();

    // Refs to track operations and retries
    const isRefreshing = useRef(false);
    const pendingRefreshTimer = useRef<NodeJS.Timeout | null>(null);
    const operationsCount = useRef(0);
    const lastOperation = useRef<number>(0);

    // Initialize categories and channels
    const [categories, setCategories] = useState<Category[]>([]);
    const [uncategorizedChannels, setUncategorizedChannels] = useState<Channel[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isRefreshingUI, setIsRefreshingUI] = useState(false);

    // Add state for create channel dialog
    const [createChannelOpen, setCreateChannelOpen] = useState(false);
    const [channelName, setChannelName] = useState("");
    const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
    const [isCreatingChannel, setIsCreatingChannel] = useState(false);

    // Track which elements are being updated
    const [updatingChannels, setUpdatingChannels] = useState<number[]>([]);
    const [updatingCategories, setUpdatingCategories] = useState<number[]>([]);

    // Add these new states for tracking drag state
    const [isDraggingOver, setIsDraggingOver] = useState<{ [key: string]: boolean }>({});
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    // Check if current user is server owner
    const isServerOwner = activeServer?.owner === activeAddress;

    // Get edit/delete handlers from context
    const { onEditCategory, onDeleteCategory, onEditChannel, onDeleteChannel } = useChannelListContext();

    // Enhanced refresh function with debounce
    const scheduleRefresh = (immediate = false) => {
        // Clear any pending refresh timer
        if (pendingRefreshTimer.current) {
            clearTimeout(pendingRefreshTimer.current);
            pendingRefreshTimer.current = null;
        }

        // If a refresh is already in progress and it's not an immediate request, 
        // schedule another refresh after the current one completes
        if (isRefreshing.current && !immediate) {
            operationsCount.current++;
            console.log(`[scheduleRefresh] Operation queued, total: ${operationsCount.current}`);
            return;
        }

        const doRefresh = async () => {
            if (isRefreshing.current) return;

            try {
                isRefreshing.current = true;
                setIsRefreshingUI(true);
                operationsCount.current = 0;
                lastOperation.current = Date.now();

                console.log(`[scheduleRefresh] Refreshing server data...`);
                await refreshServerData();

                // After refresh, check if new operations were queued during the refresh
                if (operationsCount.current > 0) {
                    console.log(`[scheduleRefresh] ${operationsCount.current} operations occurred during refresh, scheduling another refresh`);
                    pendingRefreshTimer.current = setTimeout(() => {
                        pendingRefreshTimer.current = null;
                        doRefresh();
                    }, 1000);
                }
            } catch (error) {
                console.error(`[scheduleRefresh] Error refreshing data:`, error);
                toast.error("Failed to refresh data. Some changes may not be visible.");
            } finally {
                isRefreshing.current = false;
                setIsRefreshingUI(false);
            }
        };

        if (immediate) {
            doRefresh();
        } else {
            // Delay the refresh to batch potential multiple operations
            pendingRefreshTimer.current = setTimeout(() => {
                pendingRefreshTimer.current = null;
                doRefresh();
            }, 200);
        }
    };

    // Automatic refresh after operations
    useEffect(() => {
        // Set up auto-refresh every 30 seconds
        const timer = setInterval(() => {
            // Only auto-refresh if it's been more than 30 seconds since last operation
            if (activeServerId && Date.now() - lastOperation.current > 30000) {
                console.log(`[autoRefresh] Performing periodic refresh`);
                scheduleRefresh(false);
            }
        }, 30000);

        return () => {
            clearInterval(timer);
            if (pendingRefreshTimer.current) {
                clearTimeout(pendingRefreshTimer.current);
            }
        };
    }, [activeServerId]);

    // Ensure all categories are expanded by default when server changes
    useEffect(() => {
        if (activeServer?.categories) {
            setExpandedCategories(new Set(activeServer.categories.map(cat => cat.id)));

            // Sort categories by order_id
            const sortedCategories = [...activeServer.categories].sort((a, b) => a.order_id - b.order_id);
            setCategories(sortedCategories);

            // Identify uncategorized channels
            const uncategorized = activeServer.channels
                .filter(channel => {
                    const catId = channel.category_id;
                    if (catId === null || catId === undefined) return true;
                    const categoryId = typeof catId === 'string' ? parseInt(catId, 10) : catId;
                    return !activeServer.categories.some(cat => cat.id === categoryId);
                })
                .sort((a, b) => a.order_id - b.order_id);

            setUncategorizedChannels(uncategorized);

            // Clear any updating states when new data is received
            setUpdatingChannels([]);
            setUpdatingCategories([]);
        }
    }, [activeServer]);

    // Handle creating a channel in a specific category
    const handleCreateChannelInCategory = (categoryId: number) => {
        if (!isServerOwner) return;
        setTargetCategoryId(categoryId);
        setChannelName("");
        setCreateChannelOpen(true);
    };

    // Handle creating an uncategorized channel
    const handleCreateUncategorizedChannel = () => {
        if (!isServerOwner) return;
        setTargetCategoryId(null);
        setChannelName("");
        setCreateChannelOpen(true);
    };

    // Handle manual refresh button click
    const handleManualRefresh = () => {
        if (isRefreshingUI) return;
        toast.info("Refreshing data...");
        scheduleRefresh(true);
    };

    // Handle channel create submit
    const handleCreateChannel = async () => {
        if (!activeServerId) {
            return toast.error("No active server selected");
        }

        if (!channelName.trim()) {
            return toast.error("Please enter a channel name");
        }

        setIsCreatingChannel(true);
        lastOperation.current = Date.now();

        try {
            toast.loading("Creating channel...");
            await createChannel(activeServerId, channelName.trim(), targetCategoryId);
            toast.dismiss();
            toast.success("Channel created successfully");

            setChannelName("");
            setCreateChannelOpen(false);

            // Refresh data after channel creation
            scheduleRefresh(false);
        } catch (error) {
            console.error("Error creating channel:", error);
            toast.error(error instanceof Error ? error.message : "Failed to create channel");
        } finally {
            setIsCreatingChannel(false);
        }
    };

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

    // Handle channel click
    const handleChannelClick = async (channel: Channel) => {
        // Check if this channel has unread messages
        const hasUnread = activeServerId && hasUnreadNotifications(activeServerId, channel.id.toString());

        // Update global state
        setActiveChannelId(channel.id);
        // Navigate to the channel
        navigate(`/app/${activeServerId}/${channel.id}`, { replace: true });

        // If channel has unread messages, mark them as read
        if (hasUnread && activeServerId) {
            try {
                // Mark notifications for this channel as read on the server
                await markNotificationsAsRead(activeServerId, channel.id);
                console.log(`Marked channel ${channel.id} as read`);
            } catch (error) {
                console.error("Error marking channel as read:", error);
            }
        }
    };

    // Handle drag end
    const handleDragEnd = async (result: any) => {
        const { source, destination, type, draggableId } = result;
        lastOperation.current = Date.now();

        // Dropped outside the list
        if (!destination) return;

        // No change
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === 'CATEGORY') {
            // Reordering categories
            const newCategoryOrder = Array.from(categories);
            const [removed] = newCategoryOrder.splice(source.index, 1);
            newCategoryOrder.splice(destination.index, 0, removed);

            // Update local state immediately (optimistic update)
            setCategories(newCategoryOrder);

            // Update the order_id of the moved category
            const categoryToUpdate = newCategoryOrder[destination.index];
            const newOrder = destination.index + 1;

            // Mark this category as updating
            setUpdatingCategories(prev => [...prev, categoryToUpdate.id]);

            if (activeServerId) {
                setIsUpdating(true);
                try {
                    await updateCategory(
                        activeServerId,
                        categoryToUpdate.id,
                        categoryToUpdate.name,
                        newOrder
                    );
                    toast.success('Category order updated');

                    // Refresh data after update
                    scheduleRefresh(false);
                } catch (error) {
                    console.error('Error updating category order:', error);
                    toast.error('Failed to update category order');

                    // If error, revert to server state
                    if (activeServer?.categories) {
                        const sortedCategories = [...activeServer.categories].sort((a, b) => a.order_id - b.order_id);
                        setCategories(sortedCategories);
                    }
                } finally {
                    setIsUpdating(false);
                    // Remove this category from updating list
                    setUpdatingCategories(prev => prev.filter(id => id !== categoryToUpdate.id));
                }
            }
        } else if (type === 'CHANNEL') {
            // If moving within uncategorized
            if (source.droppableId === 'uncategorized' && destination.droppableId === 'uncategorized') {
                const channelToMove = uncategorizedChannels[source.index];
                const newOrderId = destination.index + 1;

                // Update local state immediately (optimistic update)
                const newUncategorizedChannels = [...uncategorizedChannels];
                const [removed] = newUncategorizedChannels.splice(source.index, 1);
                newUncategorizedChannels.splice(destination.index, 0, removed);
                setUncategorizedChannels(newUncategorizedChannels);

                // Mark this channel as updating
                setUpdatingChannels(prev => [...prev, channelToMove.id]);

                if (activeServerId) {
                    setIsUpdating(true);
                    try {
                        await updateChannel(
                            activeServerId,
                            channelToMove.id,
                            channelToMove.name,
                            null, // null category_id for uncategorized
                            newOrderId
                        );
                        toast.success('Channel order updated');

                        // Schedule refresh after update
                        scheduleRefresh(false);
                    } catch (error) {
                        console.error('Error updating channel order:', error);
                        toast.error('Failed to update channel order');

                        // If error, revert to server state
                        if (activeServer) {
                            const uncategorized = activeServer.channels
                                .filter(channel => {
                                    const catId = channel.category_id;
                                    if (catId === null || catId === undefined) return true;
                                    const categoryId = typeof catId === 'string' ? parseInt(catId, 10) : catId;
                                    return !activeServer.categories.some(cat => cat.id === categoryId);
                                })
                                .sort((a, b) => a.order_id - b.order_id);
                            setUncategorizedChannels(uncategorized);
                        }
                    } finally {
                        setIsUpdating(false);
                        // Remove this channel from updating list
                        setUpdatingChannels(prev => prev.filter(id => id !== channelToMove.id));
                    }
                }
            }
            // If moving within a category
            else if (source.droppableId.startsWith('category-') && destination.droppableId === source.droppableId) {
                const categoryId = parseInt(source.droppableId.replace('category-', ''), 10);
                const categoryChannels = getChannelsForCategory(categoryId);

                if (categoryChannels.length > 0) {
                    const channelToMove = categoryChannels[source.index];
                    const newOrderId = destination.index + 1;

                    // Mark this channel as updating
                    setUpdatingChannels(prev => [...prev, channelToMove.id]);

                    // Create an optimistic update by modifying the local channels array
                    if (activeServer) {
                        const updatedChannels = [...activeServer.channels];
                        // Find the channel to update and update its order_id
                        const channelIndex = updatedChannels.findIndex(ch => ch.id === channelToMove.id);
                        if (channelIndex !== -1) {
                            // Create a new channel object with updated order_id
                            updatedChannels[channelIndex] = {
                                ...updatedChannels[channelIndex],
                                order_id: newOrderId
                            };

                            // Update the local state with optimistic changes
                            const updatedServer = {
                                ...activeServer,
                                channels: updatedChannels
                            };

                            // Get channels for this category with the new order
                            const updatedCategoryChannels = updatedChannels
                                .filter(channel => {
                                    const catId = channel.category_id;
                                    if (catId === null || catId === undefined) return false;
                                    const chanCatId = typeof catId === 'string' ? parseInt(catId, 10) : catId;
                                    return chanCatId === categoryId;
                                })
                                .sort((a, b) => a.order_id - b.order_id);

                            // Create a correct order array after the move
                            const reorderedChannels = [...categoryChannels];
                            const [removed] = reorderedChannels.splice(source.index, 1);
                            reorderedChannels.splice(destination.index, 0, removed);

                            // Force a re-render with the new order by updating the active server reference
                            // This is a workaround since we can't directly modify the global state
                            // but we want to show the optimistic update
                            // We'll update the actual channels array when the server responds
                        }
                    }

                    if (activeServerId) {
                        setIsUpdating(true);
                        try {
                            await updateChannel(
                                activeServerId,
                                channelToMove.id,
                                channelToMove.name,
                                categoryId,
                                newOrderId
                            );
                            toast.success('Channel order updated');

                            // Schedule refresh after update
                            scheduleRefresh(false);
                        } catch (error) {
                            console.error('Error updating channel order:', error);
                            toast.error('Failed to update channel order');
                        } finally {
                            setIsUpdating(false);
                            // Remove this channel from updating list
                            setUpdatingChannels(prev => prev.filter(id => id !== channelToMove.id));
                        }
                    }
                }
            }
            // If moving between categories or to/from uncategorized
            else if (source.droppableId !== destination.droppableId) {
                // Extract the channel being moved
                let channelToMove: Channel | undefined;

                if (source.droppableId === 'uncategorized') {
                    channelToMove = uncategorizedChannels[source.index];
                } else {
                    const sourceCategoryId = parseInt(source.droppableId.replace('category-', ''), 10);
                    const categoryChannels = getChannelsForCategory(sourceCategoryId);
                    channelToMove = categoryChannels[source.index];
                }

                if (!channelToMove) return;

                // Determine the target category (or uncategorized)
                let targetCategoryId: number | null = null;
                if (destination.droppableId !== 'uncategorized') {
                    targetCategoryId = parseInt(destination.droppableId.replace('category-', ''), 10);
                }

                // Calculate new order_id
                const newOrderId = destination.index + 1;

                // Mark this channel as updating
                setUpdatingChannels(prev => [...prev, channelToMove.id]);

                // Optimistic update for moving between categories
                if (activeServer) {
                    // Create updated uncategorized channels if source or destination is uncategorized
                    if (source.droppableId === 'uncategorized') {
                        const newUncategorized = [...uncategorizedChannels];
                        newUncategorized.splice(source.index, 1);
                        setUncategorizedChannels(newUncategorized);
                    }

                    if (destination.droppableId === 'uncategorized') {
                        const newUncategorized = [...uncategorizedChannels];
                        newUncategorized.splice(destination.index, 0, {
                            ...channelToMove,
                            category_id: null,
                            order_id: newOrderId
                        });
                        setUncategorizedChannels(newUncategorized);
                    }

                    // Force local update to display changes immediately
                    // We're using this approach since we can't directly modify the activeServer state
                    // but we want to show the optimistic update immediately
                }

                // Update the channel on the server
                if (activeServerId) {
                    setIsUpdating(true);
                    try {
                        await updateChannel(
                            activeServerId,
                            channelToMove.id,
                            channelToMove.name,
                            destination.droppableId === 'uncategorized' ? null : targetCategoryId,
                            newOrderId
                        );
                        toast.success('Channel moved successfully');

                        // Schedule refresh after update with higher priority
                        scheduleRefresh(true);
                    } catch (error) {
                        console.error('Error moving channel:', error);
                        toast.error('Failed to move channel');

                        // Revert to server state on error
                        if (activeServer) {
                            // Reset uncategorized channels
                            const uncategorized = activeServer.channels
                                .filter(channel => {
                                    const catId = channel.category_id;
                                    if (catId === null || catId === undefined) return true;
                                    const categoryId = typeof catId === 'string' ? parseInt(catId, 10) : catId;
                                    return !activeServer.categories.some(cat => cat.id === categoryId);
                                })
                                .sort((a, b) => a.order_id - b.order_id);
                            setUncategorizedChannels(uncategorized);
                        }
                    } finally {
                        setIsUpdating(false);
                        // Remove this channel from updating list
                        setUpdatingChannels(prev => prev.filter(id => id !== channelToMove.id));
                    }
                }
            }
        }
    };

    // Get channels for a specific category
    const getChannelsForCategory = (categoryId: number): Channel[] => {
        return activeServer?.channels
            .filter(channel => {
                const catId = channel.category_id;
                if (catId === null || catId === undefined) return false;
                const chanCatId = typeof catId === 'string' ? parseInt(catId, 10) : catId;
                return chanCatId === categoryId;
            })
            .sort((a, b) => a.order_id - b.order_id) || [];
    };

    if (!activeServer) {
        return <div className="py-4 text-center text-muted-foreground">No server selected</div>;
    }

    return (
        <>
            <div className="flex items-center justify-end px-2 w-fit -mb-1  absolute bottom-0">
                {isRefreshingUI ? (
                    <span className="text-xs text-muted-foreground flex items-center opacity-40">
                        <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                        Refreshing...
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground opacity-0">•</span>
                )}

                {/* <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-30 hover:opacity-100 transition-opacity"
                    onClick={handleManualRefresh}
                    disabled={isRefreshingUI}
                    title="Refresh data"
                >
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                </Button> */}
            </div>

            <DragDropContext
                onDragEnd={(result) => {
                    // Reset active drag states
                    setActiveDragId(null);
                    setIsDraggingOver({});
                    handleDragEnd(result);
                }}
                onDragStart={(start) => {
                    setActiveDragId(start.draggableId);
                }}
            >
                <div className="space-y-2 w-full">
                    {/* Uncategorized Channels Section - always show it */}
                    <Droppable droppableId="uncategorized" type="CHANNEL">
                        {(provided, snapshot) => (
                            <ContextMenu>
                                <ContextMenuTrigger asChild>
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="space-y-1 px-2 mb-1 min-h-[8px] relative"
                                    >
                                        {/* Add a header for the uncategorized section */}
                                        {/* <div className="flex items-center justify-between py-1 text-xs font-medium text-muted-foreground mt-0 "> */}
                                        {/* DONT SHOW ANY LABEL FOR UNCATEGORISED CHANNELS, JUST SHOW THE CHANNELS ON TOP */}
                                        {/* <span>UNCATEGORIZED</span> */}
                                        {/* {isServerOwner && ( */}
                                        {/* <Button */}
                                        {/* variant="ghost" */}
                                        {/* size="icon" */}
                                        {/* className="h-4 w-4 opacity-0 group-hover:opacity-100 hover:bg-muted" */}
                                        {/* onClick={handleCreateUncategorizedChannel} */}
                                        {/* > */}
                                        {/* <Plus className="h-3 w-3" /> */}
                                        {/* </Button> */}
                                        {/* )} */}
                                        {/* </div> */}

                                        {uncategorizedChannels.map((channel, index) => (
                                            <Draggable
                                                key={channel.id}
                                                draggableId={`channel-${channel.id}`}
                                                index={index}
                                                isDragDisabled={!isServerOwner || isUpdating}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                    >
                                                        <ContextMenu>
                                                            <ContextMenuTrigger asChild>
                                                                <div
                                                                    onClick={() => handleChannelClick(channel)}
                                                                    className={`flex items-center py-1 px-2 rounded-md cursor-pointer group transition-colors
                                                                        ${snapshot.isDragging ? 'bg-accent' : ''}
                                                                        ${channel.id === activeChannelId
                                                                            ? 'bg-primary/20 text-foreground'
                                                                            : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'}`
                                                                    }
                                                                >
                                                                    <div className="flex items-center gap-2 flex-1">
                                                                        <HashIcon className="h-4 w-4" />
                                                                        <span className="text-sm font-medium truncate">{channel.name}</span>
                                                                        {updatingChannels.includes(channel.id) &&
                                                                            <Loader2 className="ml-1 h-3 w-3 animate-spin text-primary" />
                                                                        }
                                                                        {activeServerId && hasUnreadNotifications(activeServerId, channel.id.toString()) &&
                                                                            channel.id !== activeChannelId && (
                                                                                <span className="ml-auto flex items-center justify-center bg-red-500 text-white rounded-full text-xs min-w-4 h-4 px-1">
                                                                                    {getUnreadCount(activeServerId, channel.id.toString())}
                                                                                </span>
                                                                            )}
                                                                    </div>
                                                                </div>
                                                            </ContextMenuTrigger>

                                                            {isServerOwner && (
                                                                <ContextMenuContent className="w-48">
                                                                    <ContextMenuItem onClick={() => onEditChannel(channel)}>
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        Edit Channel
                                                                    </ContextMenuItem>
                                                                    <ContextMenuItem onClick={() => onDeleteChannel(channel)} className="text-destructive focus:text-destructive">
                                                                        <TrashIcon className="mr-2 h-4 w-4" />
                                                                        Delete Channel
                                                                    </ContextMenuItem>
                                                                </ContextMenuContent>
                                                            )}
                                                        </ContextMenu>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}

                                        {provided.placeholder}
                                    </div>
                                </ContextMenuTrigger>

                                {isServerOwner && (
                                    <ContextMenuContent className="w-48">
                                        <ContextMenuItem onClick={handleCreateUncategorizedChannel}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Channel
                                        </ContextMenuItem>
                                    </ContextMenuContent>
                                )}
                            </ContextMenu>
                        )}
                    </Droppable>

                    {/* Categories Section */}
                    <Droppable droppableId="categories" type="CATEGORY">
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-accent/20 p-1 rounded-md' : ''}`}
                            >
                                {categories.map((category, index) => (
                                    <Draggable
                                        key={category.id.toString()}
                                        draggableId={`category-${category.id}`}
                                        index={index}
                                        isDragDisabled={!isServerOwner || isUpdating}
                                    >
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`space-y-1 rounded-md overflow-hidden
                                                ${snapshot.isDragging
                                                        ? 'opacity-90 shadow-lg ring-1 ring-primary/30 bg-background'
                                                        : ''
                                                    }`
                                                }
                                            >
                                                {/* Category Header with drag handle */}
                                                <div {...provided.dragHandleProps}>
                                                    <ContextMenu>
                                                        <ContextMenuTrigger asChild>
                                                            <div
                                                                className="flex items-center justify-between px-2 py-1 group select-none"
                                                                onClick={() => toggleCategory(category.id)}
                                                            >
                                                                <div className="flex items-center justify-between flex-1 text-xs uppercase font-semibold text-muted-foreground hover:text-foreground group transition-colors">
                                                                    <div className="flex items-center gap-1">
                                                                        <ChevronRight
                                                                            className={`h-3 w-3 transition-transform ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`}
                                                                        />
                                                                        <span>{category.name}</span>
                                                                        {updatingCategories.includes(category.id) &&
                                                                            <Loader2 className="ml-1 h-3 w-3 animate-spin text-primary" />
                                                                        }
                                                                        {/* Update the category indicator to show count */}
                                                                        {activeServerId && getChannelsForCategory(category.id).some(channel =>
                                                                            hasUnreadNotifications(activeServerId, channel.id.toString()) &&
                                                                            channel.id !== activeChannelId &&
                                                                            !expandedCategories.has(category.id)
                                                                        ) && (
                                                                                <span className="ml-1 flex items-center justify-center bg-red-500 text-white rounded-full text-xs min-w-3.5 h-3.5 px-1">
                                                                                    {getChannelsForCategory(category.id).reduce((total, channel) => {
                                                                                        if (activeServerId && hasUnreadNotifications(activeServerId, channel.id.toString()) &&
                                                                                            channel.id !== activeChannelId) {
                                                                                            return total + getUnreadCount(activeServerId, channel.id.toString());
                                                                                        }
                                                                                        return total;
                                                                                    }, 0)}
                                                                                </span>
                                                                            )}
                                                                    </div>
                                                                </div>

                                                                {isServerOwner && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCreateChannelInCategory(category.id);
                                                                        }}
                                                                        className="p-1 w-4 h-4 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-all"
                                                                        title="Create channel"
                                                                    >
                                                                        <Plus className="w-3 h-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </ContextMenuTrigger>

                                                        {isServerOwner && (
                                                            <ContextMenuContent className="w-48">
                                                                <ContextMenuItem onClick={() => onEditCategory(category)}>
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit Category
                                                                </ContextMenuItem>
                                                                <ContextMenuItem onClick={() => onDeleteCategory(category)} className="text-destructive focus:text-destructive">
                                                                    <TrashIcon className="mr-2 h-4 w-4" />
                                                                    Delete Category
                                                                </ContextMenuItem>
                                                                <ContextMenuSeparator />
                                                                <ContextMenuItem onClick={() => handleCreateChannelInCategory(category.id)}>
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    Add Channel
                                                                </ContextMenuItem>
                                                            </ContextMenuContent>
                                                        )}
                                                    </ContextMenu>
                                                </div>

                                                {/* Category Channels */}
                                                {expandedCategories.has(category.id) && (
                                                    <Droppable droppableId={`category-${category.id}`} type="CHANNEL">
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.droppableProps}
                                                                className="space-y-1 px-2 py-1"
                                                            >
                                                                {getChannelsForCategory(category.id).map((channel, channelIndex) => (
                                                                    <Draggable
                                                                        key={channel.id}
                                                                        draggableId={`channel-${channel.id}`}
                                                                        index={channelIndex}
                                                                        isDragDisabled={!isServerOwner || isUpdating}
                                                                    >
                                                                        {(provided, snapshot) => (
                                                                            <div
                                                                                ref={provided.innerRef}
                                                                                {...provided.draggableProps}
                                                                                {...provided.dragHandleProps}
                                                                            >
                                                                                <ContextMenu>
                                                                                    <ContextMenuTrigger asChild>
                                                                                        <div
                                                                                            onClick={() => handleChannelClick(channel)}
                                                                                            className={`flex items-center py-1 px-2 rounded-md cursor-pointer group transition-colors
                                                                                            ${snapshot.isDragging ? 'bg-accent' : ''}
                                                                                            ${channel.id === activeChannelId
                                                                                                    ? 'bg-primary/20 text-foreground'
                                                                                                    : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'}`
                                                                                            }
                                                                                        >
                                                                                            <div className="flex items-center gap-2 flex-1">
                                                                                                <HashIcon className="h-4 w-4" />
                                                                                                <span className="text-sm font-medium truncate">{channel.name}</span>
                                                                                                {updatingChannels.includes(channel.id) &&
                                                                                                    <Loader2 className="ml-1 h-3 w-3 animate-spin text-primary" />
                                                                                                }
                                                                                                {activeServerId && hasUnreadNotifications(activeServerId, channel.id.toString()) &&
                                                                                                    channel.id !== activeChannelId && (
                                                                                                        <span className="ml-auto flex items-center justify-center bg-red-500 text-white rounded-full text-xs min-w-4 h-4 px-1">
                                                                                                            {getUnreadCount(activeServerId, channel.id.toString())}
                                                                                                        </span>
                                                                                                    )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </ContextMenuTrigger>

                                                                                    {isServerOwner && (
                                                                                        <ContextMenuContent className="w-48">
                                                                                            <ContextMenuItem onClick={() => onEditChannel(channel)}>
                                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                                Edit Channel
                                                                                            </ContextMenuItem>
                                                                                            <ContextMenuItem onClick={() => onDeleteChannel(channel)} className="text-destructive focus:text-destructive">
                                                                                                <TrashIcon className="mr-2 h-4 w-4" />
                                                                                                Delete Channel
                                                                                            </ContextMenuItem>
                                                                                        </ContextMenuContent>
                                                                                    )}
                                                                                </ContextMenu>
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                ))}

                                                                {provided.placeholder}
                                                            </div>
                                                        )}
                                                    </Droppable>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>
            </DragDropContext>

            {/* Create Channel Dialog */}
            <AlertDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                            {targetCategoryId !== null
                                ? `Add a new channel to "${categories.find(c => c.id === targetCategoryId)?.name || 'this category'}"`
                                : "Add a new uncategorized channel"}
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
        </>
    );
} 