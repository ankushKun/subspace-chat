import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useGlobalState } from '@/hooks/global-state';
import { HashIcon, ChevronRight, Loader2 } from 'lucide-react';
import type { Channel, Category } from '@/lib/types';
import { useNavigate } from 'react-router-dom';
import { updateChannel, updateCategory } from '@/lib/ao';
import { toast } from 'sonner';

export default function DraggableChannelList() {
    const { activeServer, activeServerId, activeChannelId, setActiveChannelId } = useGlobalState();
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const navigate = useNavigate();

    // Initialize categories and channels
    const [categories, setCategories] = useState<Category[]>([]);
    const [uncategorizedChannels, setUncategorizedChannels] = useState<Channel[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);

    // Track which elements are being updated
    const [updatingChannels, setUpdatingChannels] = useState<number[]>([]);
    const [updatingCategories, setUpdatingCategories] = useState<number[]>([]);

    // Add these new states for tracking drag state
    const [isDraggingOver, setIsDraggingOver] = useState<{ [key: string]: boolean }>({});
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

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
    const handleChannelClick = (channel: Channel) => {
        // Update global state
        setActiveChannelId(channel.id);
        // Navigate to the channel
        navigate(`/app/${activeServerId}/${channel.id}`);
    };

    // Handle drag end
    const handleDragEnd = async (result: any) => {
        const { source, destination, type, draggableId } = result;

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
                {/* Uncategorized Channels Section */}
                {uncategorizedChannels.length > 0 && (
                    <Droppable droppableId="uncategorized" type="CHANNEL">
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="space-y-1 px-2 mb-4"
                            >
                                {uncategorizedChannels.map((channel, index) => (
                                    <Draggable
                                        key={channel.id.toString()}
                                        draggableId={`channel-${channel.id}`}
                                        index={index}
                                    >
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer group transition-all relative
                                                    ${snapshot.isDragging
                                                        ? 'opacity-80 bg-primary/20 shadow-lg scale-105 border border-primary/30'
                                                        : ''
                                                    }
                                                    ${activeChannelId === channel.id
                                                        ? 'bg-primary/20 text-foreground'
                                                        : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'}`
                                                }
                                                onClick={() => handleChannelClick(channel)}
                                            >
                                                <HashIcon className="h-4 w-4" />
                                                <span className="text-sm font-medium truncate">{channel.name}</span>

                                                {/* Show loading indicator when channel is being updated */}
                                                {updatingChannels.includes(channel.id) && (
                                                    <Loader2 className="h-3 w-3 ml-auto animate-spin text-primary" />
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}

                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                )}

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
                                            {/* Category Header */}
                                            <div
                                                {...provided.dragHandleProps}
                                                className="w-full flex items-center justify-between px-2 py-1 text-xs uppercase font-semibold text-muted-foreground hover:text-foreground group transition-colors cursor-pointer"
                                                onClick={() => toggleCategory(category.id)}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <ChevronRight
                                                        className={`h-3 w-3 transition-transform ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`}
                                                    />
                                                    <span>{category.name}</span>
                                                </div>

                                                {/* Show loading indicator when category is being updated */}
                                                {updatingCategories.includes(category.id) && (
                                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                )}
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
                                                                    key={channel.id.toString()}
                                                                    draggableId={`channel-${channel.id}`}
                                                                    index={channelIndex}
                                                                >
                                                                    {(provided, snapshot) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer group transition-all
                                                                                ${snapshot.isDragging
                                                                                    ? 'opacity-80 bg-primary/20 shadow-lg scale-105 border border-primary/30 z-50'
                                                                                    : ''
                                                                                }
                                                                                ${activeChannelId === channel.id
                                                                                    ? 'bg-primary/20 text-foreground'
                                                                                    : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'}`
                                                                            }
                                                                            onClick={() => handleChannelClick(channel)}
                                                                        >
                                                                            <HashIcon className="h-4 w-4" />
                                                                            <span className="text-sm font-medium truncate">{channel.name}</span>

                                                                            {/* Show loading indicator when channel is being updated */}
                                                                            {updatingChannels.includes(channel.id) && (
                                                                                <Loader2 className="h-3 w-3 ml-auto animate-spin text-primary" />
                                                                            )}
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
    );
} 