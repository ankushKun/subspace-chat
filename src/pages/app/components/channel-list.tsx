import { useServer } from "@/hooks/subspace/server"
import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Hash, Plus, Loader2, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Category, Channel, Server } from "@/types/subspace"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import useSubspace, { useNotifications } from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import UserProfile from "./user-profile"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Screens } from ".."
import ServerSettings from "./server-settings"

// Components are now defined inline within the main component for better state access

export default function ChannelList({ setScreen, ...props }: React.HTMLAttributes<HTMLDivElement> & { setScreen?: Dispatch<SetStateAction<Screens>> }) {
    const { servers, activeServerId, activeChannelId, actions } = useServer()
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
    const subspace = useSubspace()
    const { address } = useWallet()
    const { unreadCountsByChannel } = useNotifications()

    // Drag and drop state
    const [isUpdating, setIsUpdating] = useState(false)
    const [updatingChannels, setUpdatingChannels] = useState<number[]>([])
    const [updatingCategories, setUpdatingCategories] = useState<number[]>([])

    // Create/Edit dialogs state
    const [createChannelOpen, setCreateChannelOpen] = useState(false)
    const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
    const [editChannelOpen, setEditChannelOpen] = useState(false)
    const [editCategoryOpen, setEditCategoryOpen] = useState(false)
    const [deleteChannelOpen, setDeleteChannelOpen] = useState(false)
    const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false)

    const [channelName, setChannelName] = useState("")
    const [categoryName, setCategoryName] = useState("")
    const [editChannelName, setEditChannelName] = useState("")
    const [editCategoryName, setEditCategoryName] = useState("")
    const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null)
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

    // Context menu state
    const [showChannelContextMenu, setShowChannelContextMenu] = useState(false)
    const [showCategoryContextMenu, setShowCategoryContextMenu] = useState(false)

    const [isCreatingChannel, setIsCreatingChannel] = useState(false)
    const [isCreatingCategory, setIsCreatingCategory] = useState(false)
    const [isEditingChannel, setIsEditingChannel] = useState(false)
    const [isEditingCategory, setIsEditingCategory] = useState(false)
    const [isDeletingChannel, setIsDeletingChannel] = useState(false)
    const [isDeletingCategory, setIsDeletingCategory] = useState(false)

    const server = activeServerId ? servers[activeServerId] : null
    const isServerOwner = !!(server?.owner === address)

    // Organize channels by categories
    const { categories, categorizedChannels, uncategorizedChannels } = useMemo(() => {
        if (!server) {
            return { categories: [] as Category[], categorizedChannels: new Map(), uncategorizedChannels: [] as Channel[] }
        }

        // Sort categories by order
        const sortedCategories = [...server.categories].sort((a, b) => a.orderId - b.orderId)

        // Create map of category ID to channels
        const channelsByCategory = new Map<number, Channel[]>()
        const categoryIds = new Set(sortedCategories.map(cat => cat.categoryId))

        // Categorize channels
        for (const channel of server.channels) {
            if (channel.categoryId && categoryIds.has(channel.categoryId)) {
                if (!channelsByCategory.has(channel.categoryId)) {
                    channelsByCategory.set(channel.categoryId, [])
                }
                channelsByCategory.get(channel.categoryId)?.push(channel)
            }
        }

        // Sort channels within each category
        for (const [categoryId, channels] of channelsByCategory.entries()) {
            channelsByCategory.set(
                categoryId,
                channels.sort((a, b) => a.orderId - b.orderId)
            )
        }

        // Get uncategorized channels
        const uncategorized = server.channels
            .filter(channel => !channel.categoryId || !categoryIds.has(channel.categoryId))
            .sort((a, b) => a.orderId - b.orderId)

        return {
            categories: sortedCategories,
            categorizedChannels: channelsByCategory,
            uncategorizedChannels: uncategorized
        }
    }, [server])

    // Initialize expanded categories when server changes
    useEffect(() => {
        if (server?.categories) {
            setExpandedCategories(new Set(server.categories.map(cat => cat.categoryId)))
        }
    }, [server?.categories])

    const toggleCategory = (categoryId: number) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev)
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId)
            } else {
                newSet.add(categoryId)
            }
            return newSet
        })
    }

    // Get channels for a specific category
    const getChannelsForCategory = (categoryId: number): Channel[] => {
        return server?.channels
            .filter(channel => channel.categoryId === categoryId)
            .sort((a, b) => a.orderId - b.orderId) || []
    }

    // Handle drag end
    const handleDragEnd = async (result: any) => {
        const { source, destination, type } = result

        // Dropped outside the list
        if (!destination) return

        // No change
        if (source.droppableId === destination.droppableId && source.index === destination.index) return

        if (!activeServerId || !server) return

        if (type === 'CATEGORY') {
            // Reordering categories
            const newCategoryOrder = Array.from(categories)
            const [removed] = newCategoryOrder.splice(source.index, 1)
            newCategoryOrder.splice(destination.index, 0, removed)

            // Update local state immediately (optimistic update)
            const updatedServer = {
                ...server,
                categories: newCategoryOrder.map((cat, index) => ({
                    ...cat,
                    orderId: index + 1
                }))
            }
            actions.updateServer(activeServerId, updatedServer)

            // Update the order_id of the moved category
            const categoryToUpdate = newCategoryOrder[destination.index]
            const newOrder = destination.index + 1

            // Mark this category as updating
            setUpdatingCategories(prev => [...prev, categoryToUpdate.categoryId])

            setIsUpdating(true)
            try {
                const success = await subspace.server.category.updateCategory({
                    serverId: activeServerId,
                    categoryId: categoryToUpdate.categoryId,
                    orderId: newOrder
                })

                if (success) {
                    toast.success('Category order updated')
                } else {
                    throw new Error('Failed to update category order')
                }
            } catch (error) {
                console.error('Error updating category order:', error)
                toast.error('Failed to update category order')

                // Revert optimistic update
                actions.updateServer(activeServerId, server)
            } finally {
                setIsUpdating(false)
                setUpdatingCategories(prev => prev.filter(id => id !== categoryToUpdate.categoryId))
            }
        } else if (type === 'CHANNEL') {
            // Handle channel reordering
            if (source.droppableId === 'uncategorized' && destination.droppableId === 'uncategorized') {
                // Moving within uncategorized
                const channelToMove = uncategorizedChannels[source.index]
                const newOrderId = destination.index + 1

                // Optimistic update
                const newUncategorizedChannels = [...uncategorizedChannels]
                const [removed] = newUncategorizedChannels.splice(source.index, 1)
                newUncategorizedChannels.splice(destination.index, 0, removed)

                const updatedChannels = server.channels.map(ch => {
                    if (ch.channelId === channelToMove.channelId) {
                        return { ...ch, orderId: newOrderId }
                    }
                    return ch
                })

                const updatedServer = { ...server, channels: updatedChannels }
                actions.updateServer(activeServerId, updatedServer)

                setUpdatingChannels(prev => [...prev, channelToMove.channelId])
                setIsUpdating(true)

                try {
                    const success = await subspace.server.channel.updateChannel({
                        serverId: activeServerId,
                        channelId: channelToMove.channelId,
                        orderId: newOrderId
                    })

                    if (success) {
                        toast.success('Channel order updated')
                    } else {
                        throw new Error('Failed to update channel order')
                    }
                } catch (error) {
                    console.error('Error updating channel order:', error)
                    toast.error('Failed to update channel order')
                    actions.updateServer(activeServerId, server)
                } finally {
                    setIsUpdating(false)
                    setUpdatingChannels(prev => prev.filter(id => id !== channelToMove.channelId))
                }
            } else if (source.droppableId.startsWith('category-') && destination.droppableId === source.droppableId) {
                // Moving within a category
                const categoryId = parseInt(source.droppableId.replace('category-', ''), 10)
                const categoryChannels = getChannelsForCategory(categoryId)
                const channelToMove = categoryChannels[source.index]
                const newOrderId = destination.index + 1

                setUpdatingChannels(prev => [...prev, channelToMove.channelId])
                setIsUpdating(true)

                try {
                    const success = await subspace.server.channel.updateChannel({
                        serverId: activeServerId,
                        channelId: channelToMove.channelId,
                        orderId: newOrderId
                    })

                    if (success) {
                        toast.success('Channel order updated')
                        // Refresh server data to get updated order
                        const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                        if (updatedServer) {
                            actions.updateServer(activeServerId, updatedServer as Server)
                        }
                    } else {
                        throw new Error('Failed to update channel order')
                    }
                } catch (error) {
                    console.error('Error updating channel order:', error)
                    toast.error('Failed to update channel order')
                } finally {
                    setIsUpdating(false)
                    setUpdatingChannels(prev => prev.filter(id => id !== channelToMove.channelId))
                }
            } else if (source.droppableId !== destination.droppableId) {
                // Moving between categories or to/from uncategorized
                let channelToMove: Channel | undefined

                if (source.droppableId === 'uncategorized') {
                    channelToMove = uncategorizedChannels[source.index]
                } else {
                    const sourceCategoryId = parseInt(source.droppableId.replace('category-', ''), 10)
                    const categoryChannels = getChannelsForCategory(sourceCategoryId)
                    channelToMove = categoryChannels[source.index]
                }

                if (!channelToMove) return

                // Determine the target category
                let targetCategoryId: number | null = null
                if (destination.droppableId !== 'uncategorized') {
                    targetCategoryId = parseInt(destination.droppableId.replace('category-', ''), 10)
                }

                const newOrderId = destination.index + 1

                setUpdatingChannels(prev => [...prev, channelToMove.channelId])
                setIsUpdating(true)

                try {
                    const success = await subspace.server.channel.updateChannel({
                        serverId: activeServerId,
                        channelId: channelToMove.channelId,
                        parentCategoryId: targetCategoryId,
                        orderId: newOrderId
                    })

                    if (success) {
                        toast.success('Channel moved successfully')
                        // Refresh server data to get updated structure
                        const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                        if (updatedServer) {
                            actions.updateServer(activeServerId, updatedServer as Server)
                        }
                    } else {
                        throw new Error('Failed to move channel')
                    }
                } catch (error) {
                    console.error('Error moving channel:', error)
                    toast.error('Failed to move channel')
                } finally {
                    setIsUpdating(false)
                    setUpdatingChannels(prev => prev.filter(id => id !== channelToMove.channelId))
                }
            }
        }
    }

    // CRUD handlers for categories and channels
    const handleCreateCategory = async () => {
        if (!activeServerId || !categoryName.trim()) {
            toast.error("Please enter a category name")
            return
        }

        setIsCreatingCategory(true)
        try {
            const categoryId = await subspace.server.category.createCategory({
                serverId: activeServerId,
                name: categoryName.trim()
            })

            if (categoryId) {
                toast.success("Category created successfully")
                setCategoryName("")
                setCreateCategoryOpen(false)

                // Refresh server data
                const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                if (updatedServer) {
                    actions.updateServer(activeServerId, updatedServer as Server)
                }
            } else {
                toast.error("Failed to create category")
            }
        } catch (error) {
            console.error("Error creating category:", error)
            toast.error("Failed to create category")
        } finally {
            setIsCreatingCategory(false)
        }
    }

    const handleCreateChannel = async () => {
        if (!activeServerId || !channelName.trim()) {
            toast.error("Please enter a channel name")
            return
        }

        setIsCreatingChannel(true)
        try {
            const result = await subspace.server.channel.createChannel({
                serverId: activeServerId,
                name: channelName.trim(),
                parentCategoryId: targetCategoryId
            })

            if (result) {
                toast.success("Channel created successfully")
                setChannelName("")
                setCreateChannelOpen(false)
                setTargetCategoryId(null)

                // Refresh server data
                const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                if (updatedServer) {
                    actions.updateServer(activeServerId, updatedServer as Server)
                }
            } else {
                toast.error("Failed to create channel")
            }
        } catch (error) {
            console.error("Error creating channel:", error)
            toast.error("Failed to create channel")
        } finally {
            setIsCreatingChannel(false)
        }
    }

    const handleEditCategory = async () => {
        if (!activeServerId || !selectedCategory || !editCategoryName.trim()) {
            toast.error("Please enter a category name")
            return
        }

        setIsEditingCategory(true)
        try {
            const success = await subspace.server.category.updateCategory({
                serverId: activeServerId,
                categoryId: selectedCategory.categoryId,
                name: editCategoryName.trim()
            })

            if (success) {
                toast.success("Category updated successfully")
                setEditCategoryName("")
                setEditCategoryOpen(false)
                setSelectedCategory(null)

                // Refresh server data
                const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                if (updatedServer) {
                    actions.updateServer(activeServerId, updatedServer as Server)
                }
            } else {
                toast.error("Failed to update category")
            }
        } catch (error) {
            console.error("Error updating category:", error)
            toast.error("Failed to update category")
        } finally {
            setIsEditingCategory(false)
        }
    }

    const handleEditChannel = async () => {
        if (!activeServerId || !selectedChannel || !editChannelName.trim()) {
            toast.error("Please enter a channel name")
            return
        }

        setIsEditingChannel(true)
        try {
            const success = await subspace.server.channel.updateChannel({
                serverId: activeServerId,
                channelId: selectedChannel.channelId,
                name: editChannelName.trim()
            })

            if (success) {
                toast.success("Channel updated successfully")
                setEditChannelName("")
                setEditChannelOpen(false)
                setSelectedChannel(null)

                // Refresh server data
                const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                if (updatedServer) {
                    actions.updateServer(activeServerId, updatedServer as Server)
                }
            } else {
                toast.error("Failed to update channel")
            }
        } catch (error) {
            console.error("Error updating channel:", error)
            toast.error("Failed to update channel")
        } finally {
            setIsEditingChannel(false)
        }
    }

    const handleDeleteCategory = async () => {
        if (!activeServerId || !selectedCategory) {
            toast.error("No category selected")
            return
        }

        setIsDeletingCategory(true)
        try {
            const channelsUpdated = await subspace.server.category.deleteCategory({
                serverId: activeServerId,
                categoryId: selectedCategory.categoryId
            })

            if (channelsUpdated !== null) {
                toast.success("Category deleted successfully")
                setDeleteCategoryOpen(false)
                setSelectedCategory(null)

                // Refresh server data
                const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                if (updatedServer) {
                    actions.updateServer(activeServerId, updatedServer as Server)
                }
            } else {
                toast.error("Failed to delete category")
            }
        } catch (error) {
            console.error("Error deleting category:", error)
            toast.error("Failed to delete category")
        } finally {
            setIsDeletingCategory(false)
        }
    }

    const handleDeleteChannel = async () => {
        if (!activeServerId || !selectedChannel) {
            toast.error("No channel selected")
            return
        }

        setIsDeletingChannel(true)
        try {
            const messagesDeleted = await subspace.server.channel.deleteChannel({
                serverId: activeServerId,
                channelId: selectedChannel.channelId
            })

            if (messagesDeleted !== null) {
                toast.success("Channel deleted successfully")
                setDeleteChannelOpen(false)
                setSelectedChannel(null)

                // Refresh server data
                const updatedServer = await subspace.server.getServerDetails({ serverId: activeServerId })
                if (updatedServer) {
                    actions.updateServer(activeServerId, updatedServer as Server)
                }
            } else {
                toast.error("Failed to delete channel")
            }
        } catch (error) {
            console.error("Error deleting channel:", error)
            toast.error("Failed to delete channel")
        } finally {
            setIsDeletingChannel(false)
        }
    }

    // Initialize dialog states when opening
    useEffect(() => {
        if (editCategoryOpen && selectedCategory) {
            setEditCategoryName(selectedCategory.name)
        }
    }, [editCategoryOpen, selectedCategory])

    useEffect(() => {
        if (editChannelOpen && selectedChannel) {
            setEditChannelName(selectedChannel.name)
        }
    }, [editChannelOpen, selectedChannel])

    // Show placeholder when server is selected but not found
    if (!server) {
        return (
            <div
                {...props}
                className={cn(
                    "flex flex-col w-60 h-full py-4 px-3",
                    "bg-gradient-to-b from-background via-background/95 to-background/90",
                    "border-r border-border/50 backdrop-blur-sm",
                    props.className
                )}
            >
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                        <Hash className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Server not found</p>
                    </div>
                </div>

            </div>
        )
    }

    return (
        <div
            {...props}
            className={cn(
                "flex flex-col w-60 h-full relative",
                "bg-gradient-to-b from-background via-background/95 to-background/90",
                "border-r border-b border-border/50 backdrop-blur-sm rounded-br-lg",
                "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40",
                // Subtle pattern overlay
                "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] before:pointer-events-none",
                props.className
            )}
        >
            {/* Ambient glow at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-primary/5 rounded-full blur-2xl" />

            {/* Server name header */}
            <div className="mb-4 p-0 flex flex-col justify-center items-center relative">
                <ServerSettings
                    server={server}
                    onCreateCategory={() => setCreateCategoryOpen(true)}
                    onCreateChannel={(categoryId) => {
                        setTargetCategoryId(categoryId || null)
                        setCreateChannelOpen(true)
                    }}
                />
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent absolute bottom-0" />
            </div>

            {/* Channels content with drag and drop */}
            <div className="flex-1 overflow-y-auto px-2">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="space-y-2">
                        {/* Uncategorized channels */}
                        <Droppable droppableId="uncategorized" type="CHANNEL">
                            {(provided, snapshot) => (
                                <ContextMenu>
                                    <ContextMenuTrigger asChild>
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={cn(
                                                "space-y-0.5 min-h-[8px] relative",
                                                snapshot.isDraggingOver && "bg-accent/20 rounded-md p-1"
                                            )}
                                        >
                                            {uncategorizedChannels.map((channel, index) => (
                                                <Draggable
                                                    key={channel.channelId}
                                                    draggableId={`channel-${channel.channelId}`}
                                                    index={index}
                                                    isDragDisabled={!isServerOwner || isUpdating}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "group relative",
                                                                    snapshot.isDragging && "opacity-90 shadow-lg ring-1 ring-primary/30 bg-background rounded-md"
                                                                )}
                                                            >
                                                                <div
                                                                    className={cn(
                                                                        "w-full h-8 px-2 flex items-center gap-2 text-sm transition-all duration-200 relative overflow-hidden cursor-pointer",
                                                                        "hover:bg-muted/50 rounded-md",
                                                                        channel.channelId === activeChannelId
                                                                            ? "bg-accent/20 text-foreground font-medium"
                                                                            : "text-muted-foreground hover:text-foreground",
                                                                        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                                                                    )}
                                                                    onClick={() => actions.setActiveChannelId(channel.channelId)}
                                                                    onContextMenu={(e) => {
                                                                        if (isServerOwner) {
                                                                            e.preventDefault()
                                                                            setSelectedChannel(channel)
                                                                            setShowChannelContextMenu(true)
                                                                        }
                                                                    }}
                                                                >
                                                                    <Hash className={cn(
                                                                        "w-4 h-4 transition-all duration-200 flex-shrink-0",
                                                                        channel.channelId === activeChannelId
                                                                            ? "text-foreground"
                                                                            : "text-muted-foreground/60 group-hover:text-muted-foreground"
                                                                    )} />
                                                                    <span className="truncate">{channel.name}</span>
                                                                    <div className="ml-auto flex items-center gap-1">
                                                                        {/* Mention count badge */}
                                                                        {activeServerId && unreadCountsByChannel[activeServerId]?.[channel.channelId.toString()] > 0 && channel.channelId !== activeChannelId && (
                                                                            <div className={cn(
                                                                                "flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-semibold text-white rounded-full",
                                                                                "bg-gradient-to-br from-red-500 to-red-600 shadow-sm shadow-red-500/30",
                                                                                "border border-background/20",
                                                                                "transition-all duration-200 ease-out"
                                                                            )}>
                                                                                {unreadCountsByChannel[activeServerId][channel.channelId.toString()] > 99 ? '99+' : unreadCountsByChannel[activeServerId][channel.channelId.toString()]}
                                                                            </div>
                                                                        )}
                                                                        {updatingChannels.includes(channel.channelId) && (
                                                                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </ContextMenuTrigger>

                                    {isServerOwner && (
                                        <ContextMenuContent className="w-48">
                                            <ContextMenuItem onClick={() => {
                                                setTargetCategoryId(null)
                                                setCreateChannelOpen(true)
                                            }}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Channel
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    )}
                                </ContextMenu>
                            )}
                        </Droppable>

                        {/* Categories */}
                        <Droppable droppableId="categories" type="CATEGORY">
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                        "space-y-2",
                                        snapshot.isDraggingOver && "bg-accent/20 p-1 rounded-md"
                                    )}
                                >
                                    {categories.map((category, index) => {
                                        const categoryChannels = categorizedChannels.get(category.categoryId) || []
                                        const isExpanded = expandedCategories.has(category.categoryId)

                                        return (
                                            <Draggable
                                                key={category.categoryId}
                                                draggableId={`category-${category.categoryId}`}
                                                index={index}
                                                isDragDisabled={!isServerOwner || isUpdating}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={cn(
                                                            "space-y-1 rounded-md overflow-hidden",
                                                            snapshot.isDragging && "opacity-90 shadow-lg ring-1 ring-primary/30 bg-background"
                                                        )}
                                                    >
                                                        {/* Category Header with drag handle */}
                                                        <div
                                                            {...provided.dragHandleProps}
                                                            className={cn(
                                                                "group relative cursor-pointer",
                                                                snapshot.isDragging && "opacity-90 shadow-lg ring-1 ring-primary/30 bg-background rounded-md"
                                                            )}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "w-full h-8 px-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                                                                    "text-muted-foreground hover:text-foreground",
                                                                    "hover:bg-muted/50 rounded-md",
                                                                    "group-hover:bg-muted/30"
                                                                )}
                                                                onClick={() => toggleCategory(category.categoryId)}
                                                                onContextMenu={(e) => {
                                                                    if (isServerOwner) {
                                                                        e.preventDefault()
                                                                        setSelectedCategory(category)
                                                                        setShowCategoryContextMenu(true)
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="w-3 h-3 transition-transform duration-200" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3 h-3 transition-transform duration-200" />
                                                                    )}
                                                                    <span className="truncate">{category.name}</span>
                                                                    {updatingCategories.includes(category.categoryId) && (
                                                                        <Loader2 className="ml-1 h-3 w-3 animate-spin text-primary" />
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-muted-foreground/60">{categoryChannels.length}</span>
                                                                    {/* Category mention count badge - only show when collapsed and has unread mentions */}
                                                                    {!isExpanded && activeServerId && (() => {
                                                                        const categoryUnreadCount = categoryChannels.reduce((total, channel) => {
                                                                            const channelUnread = unreadCountsByChannel[activeServerId]?.[channel.channelId.toString()] || 0;
                                                                            return total + (channel.channelId !== activeChannelId ? channelUnread : 0);
                                                                        }, 0);
                                                                        return categoryUnreadCount > 0 ? (
                                                                            <div className={cn(
                                                                                "flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[8px] font-semibold text-white rounded-full",
                                                                                "bg-gradient-to-br from-red-500 to-red-600 shadow-sm shadow-red-500/30",
                                                                                "border border-background/20",
                                                                                "transition-all duration-200 ease-out"
                                                                            )}>
                                                                                {categoryUnreadCount > 99 ? '99+' : categoryUnreadCount}
                                                                            </div>
                                                                        ) : null;
                                                                    })()}
                                                                    {isServerOwner && (
                                                                        <button
                                                                            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-muted transition-all rounded flex items-center justify-center"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setTargetCategoryId(category.categoryId)
                                                                                setCreateChannelOpen(true)
                                                                            }}
                                                                        >
                                                                            <Plus className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Category Channels */}
                                                        {isExpanded && (
                                                            <Droppable droppableId={`category-${category.categoryId}`} type="CHANNEL">
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.droppableProps}
                                                                        className={cn(
                                                                            "space-y-0.5 ml-2",
                                                                            snapshot.isDraggingOver && "bg-accent/20 rounded-md p-1"
                                                                        )}
                                                                    >
                                                                        {categoryChannels.map((channel, channelIndex) => (
                                                                            <Draggable
                                                                                key={channel.channelId}
                                                                                draggableId={`channel-${channel.channelId}`}
                                                                                index={channelIndex}
                                                                                isDragDisabled={!isServerOwner || isUpdating}
                                                                            >
                                                                                {(provided, snapshot) => (
                                                                                    <div
                                                                                        ref={provided.innerRef}
                                                                                        {...provided.draggableProps}
                                                                                        {...provided.dragHandleProps}
                                                                                    >
                                                                                        <div
                                                                                            className={cn(
                                                                                                "group relative ml-2",
                                                                                                snapshot.isDragging && "opacity-90 shadow-lg ring-1 ring-primary/30 bg-background rounded-md"
                                                                                            )}
                                                                                        >
                                                                                            <div
                                                                                                className={cn(
                                                                                                    "w-full h-8 px-2 flex items-center gap-2 text-sm transition-all duration-200 relative overflow-hidden cursor-pointer",
                                                                                                    "hover:bg-muted/50 rounded-md",
                                                                                                    channel.channelId === activeChannelId
                                                                                                        ? "bg-accent/20 text-foreground font-medium"
                                                                                                        : "text-muted-foreground hover:text-foreground",
                                                                                                    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                                                                                                )}
                                                                                                onClick={() => { actions.setActiveChannelId(channel.channelId); setScreen(Screens.Middle) }}
                                                                                                onContextMenu={(e) => {
                                                                                                    if (isServerOwner) {
                                                                                                        e.preventDefault()
                                                                                                        setSelectedChannel(channel)
                                                                                                        setShowChannelContextMenu(true)
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                <Hash className={cn(
                                                                                                    "w-4 h-4 transition-all duration-200 flex-shrink-0",
                                                                                                    channel.channelId === activeChannelId
                                                                                                        ? "text-foreground"
                                                                                                        : "text-muted-foreground/60 group-hover:text-muted-foreground"
                                                                                                )} />
                                                                                                <span className="truncate">{channel.name}</span>
                                                                                                <div className="ml-auto flex items-center gap-1">
                                                                                                    {/* Mention count badge */}
                                                                                                    {activeServerId && unreadCountsByChannel[activeServerId]?.[channel.channelId.toString()] > 0 && channel.channelId !== activeChannelId && (
                                                                                                        <div className={cn(
                                                                                                            "flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-semibold text-white rounded-full",
                                                                                                            "bg-gradient-to-br from-red-500 to-red-600 shadow-sm shadow-red-500/30",
                                                                                                            "border border-background/20",
                                                                                                            "transition-all duration-200 ease-out"
                                                                                                        )}>
                                                                                                            {unreadCountsByChannel[activeServerId][channel.channelId.toString()] > 99 ? '99+' : unreadCountsByChannel[activeServerId][channel.channelId.toString()]}
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {updatingChannels.includes(channel.channelId) && (
                                                                                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
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
                                        )
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                </DragDropContext>
            </div >

            {/* Ambient glow at bottom */}
            < div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-12 bg-primary/3 rounded-full blur-xl" />

            {/* Channel Context Menu Dialog */}
            <AlertDialog open={showChannelContextMenu} onOpenChange={setShowChannelContextMenu}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Channel Actions</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose an action for "{selectedChannel?.name}"
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowChannelContextMenu(false)
                                setEditChannelOpen(true)
                            }}
                            className="justify-start"
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Channel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowChannelContextMenu(false)
                                setDeleteChannelOpen(true)
                            }}
                            className="justify-start text-destructive hover:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Channel
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Category Context Menu Dialog */}
            <AlertDialog open={showCategoryContextMenu} onOpenChange={setShowCategoryContextMenu}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Category Actions</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose an action for "{selectedCategory?.name}"
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCategoryContextMenu(false)
                                setEditCategoryOpen(true)
                            }}
                            className="justify-start"
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Category
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCategoryContextMenu(false)
                                setDeleteCategoryOpen(true)
                            }}
                            className="justify-start text-destructive hover:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Category
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCategoryContextMenu(false)
                                if (selectedCategory) {
                                    setTargetCategoryId(selectedCategory.categoryId)
                                    setCreateChannelOpen(true)
                                }
                            }}
                            className="justify-start"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Channel
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Category Dialog */}
            < AlertDialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen} >
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
            </AlertDialog >

            {/* Create Channel Dialog */}
            < AlertDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen} >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                            {targetCategoryId !== null
                                ? `Add a new channel to "${categories.find(c => c.categoryId === targetCategoryId)?.name || 'this category'}"`
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
            </AlertDialog >

            {/* Edit Category Dialog */}
            < AlertDialog open={editCategoryOpen} onOpenChange={setEditCategoryOpen} >
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
            </AlertDialog >

            {/* Edit Channel Dialog */}
            < AlertDialog open={editChannelOpen} onOpenChange={setEditChannelOpen} >
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
            </AlertDialog >

            {/* Delete Category Dialog */}
            < AlertDialog open={deleteCategoryOpen} onOpenChange={setDeleteCategoryOpen} >
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
            </AlertDialog >

            {/* Delete Channel Dialog */}
            < AlertDialog open={deleteChannelOpen} onOpenChange={setDeleteChannelOpen} >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this channel? Although this channel will loose it's messages, they will still exist somewhere on the permaweb
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
            </AlertDialog >
        </div >
    )
}