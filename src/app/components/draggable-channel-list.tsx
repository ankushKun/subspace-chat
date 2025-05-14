import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useGlobalState } from '@/hooks/global-state';
import { HashIcon, ChevronRight } from 'lucide-react';
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

            // Update the order_id of the moved category
            const categoryToUpdate = newCategoryOrder[destination.index];
            const newOrder = destination.index + 1;

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
                } finally {
                    setIsUpdating(false);
                }
            }
        } else if (type === 'CHANNEL') {
            // If moving within uncategorized
            if (source.droppableId === 'uncategorized' && destination.droppableId === 'uncategorized') {
                const channelToMove = uncategorizedChannels[source.index];
                const newOrderId = destination.index + 1;

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
                    } finally {
                        setIsUpdating(false);
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
                    } finally {
                        setIsUpdating(false);
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
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="space-y-2 w-full">
                {/* Uncategorized Channels Section */}
                {uncategorizedChannels.length > 0 && (
                    <Droppable droppableId="uncategorized" type="CHANNEL">
                        {(provided) => (
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
                                                className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer group transition-colors
                                                    ${snapshot.isDragging ? 'opacity-70 bg-accent' : ''}
                                                    ${activeChannelId === channel.id
                                                        ? 'bg-primary/20 text-foreground'
                                                        : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'}`
                                                }
                                                onClick={() => handleChannelClick(channel)}
                                            >
                                                <HashIcon className="h-4 w-4" />
                                                <span className="text-sm font-medium truncate">{channel.name}</span>
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
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2"
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
                                            className={`space-y-1 ${snapshot.isDragging ? 'opacity-70' : ''}`}
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
                                            </div>

                                            {/* Category Channels */}
                                            {expandedCategories.has(category.id) && (
                                                <Droppable droppableId={`category-${category.id}`} type="CHANNEL">
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className="space-y-1 px-2"
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
                                                                            className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer group transition-colors
                                                                                ${snapshot.isDragging ? 'opacity-70 bg-accent' : ''}
                                                                                ${activeChannelId === channel.id
                                                                                    ? 'bg-primary/20 text-foreground'
                                                                                    : 'hover:bg-accent/40 text-muted-foreground hover:text-foreground'}`
                                                                            }
                                                                            onClick={() => handleChannelClick(channel)}
                                                                        >
                                                                            <HashIcon className="h-4 w-4" />
                                                                            <span className="text-sm font-medium truncate">{channel.name}</span>
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