import { useServer } from "@/hooks/subspace/server"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Hash, Volume2, Lock, Settings, Plus, MessageCircle, Search, UserPlus, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Category, Channel } from "@/types/subspace"
import { useProfile } from "@/hooks/subspace"

// Mock DM type - you might want to add this to your types
type DirectMessage = {
    userId: string;
    username: string;
    avatar?: string;
    lastMessage?: string;
    timestamp?: number;
    unreadCount?: number;
    isOnline?: boolean;
}

const DMItem = ({
    dm,
    isActive = false,
    onClick
}: {
    dm: DirectMessage;
    isActive?: boolean;
    onClick?: () => void;
}) => {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group">
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full h-12 px-2 justify-start text-sm transition-all duration-200 relative overflow-hidden",
                    "hover:bg-muted/50 rounded-md",
                    isActive
                        ? "bg-accent/20 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={onClick}
            >
                <div className="flex items-center gap-3 w-full relative z-10">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                            {dm.avatar ? (
                                <img
                                    src={`https://arweave.net/${dm.avatar}`}
                                    alt={dm.username}
                                    className="w-full h-full object-cover rounded-full"
                                />
                            ) : (
                                <span className="text-primary font-semibold text-xs">
                                    {dm.username.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        {/* Online indicator */}
                        {dm.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground truncate">
                                {dm.username}
                            </span>
                            {dm.unreadCount && dm.unreadCount > 0 && (
                                <div className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                                    {dm.unreadCount > 99 ? '99+' : dm.unreadCount}
                                </div>
                            )}
                        </div>
                        {dm.lastMessage && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                                {dm.lastMessage}
                            </p>
                        )}
                    </div>
                </div>

                {/* Subtle shimmer effect on hover */}
                {isHovered && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                )}
            </Button>
        </div>
    )
}

const DMsList = () => {
    const { profiles } = useProfile()
    const [searchQuery, setSearchQuery] = useState("")

    // Mock DMs data - replace with real data from your state management
    const mockDMs: DirectMessage[] = [
        {
            userId: "user1",
            username: "Alice",
            lastMessage: "Hey, how's the project going?",
            timestamp: Date.now() - 300000,
            unreadCount: 2,
            isOnline: true
        },
        {
            userId: "user2",
            username: "Bob",
            lastMessage: "Thanks for the help earlier!",
            timestamp: Date.now() - 3600000,
            unreadCount: 0,
            isOnline: false
        },
        {
            userId: "user3",
            username: "Charlie",
            lastMessage: "Let's catch up soon",
            timestamp: Date.now() - 86400000,
            unreadCount: 1,
            isOnline: true
        }
    ]

    const filteredDMs = mockDMs.filter(dm =>
        dm.username.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-4 p-4 flex flex-col justify-center items-start relative">
                <div className="flex items-center gap-2 w-full">
                    <MessageCircle className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">
                        Direct Messages
                    </h2>
                </div>
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent absolute bottom-0" />
            </div>

            {/* Search and actions */}
            <div className="px-2 mb-4 space-y-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 px-2 justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                    <Search className="w-4 h-4 mr-2" />
                    Find or start a conversation
                </Button>
            </div>

            {/* DMs list */}
            <div className="flex-1 overflow-y-auto space-y-1 px-2">
                {filteredDMs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                        <MessageCircle className="w-8 h-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No conversations yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Start a conversation with someone!
                        </p>
                    </div>
                ) : (
                    filteredDMs.map((dm) => (
                        <DMItem
                            key={dm.userId}
                            dm={dm}
                            isActive={false} // TODO: Implement active DM logic
                            onClick={() => {
                                console.log('Open DM with:', dm.username)
                                // TODO: Implement DM opening logic
                            }}
                        />
                    ))
                )}
            </div>

            {/* Quick actions */}
            <div className="p-2 border-t border-border/30 mt-auto">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 px-2 justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                </Button>
            </div>
        </div>
    )
}

const CategoryHeader = ({
    category,
    isExpanded,
    onToggle,
    channelCount
}: {
    category: Category;
    isExpanded: boolean;
    onToggle: () => void;
    channelCount: number;
}) => {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group">
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full h-8 px-2 justify-start text-xs font-semibold uppercase tracking-wider transition-all duration-200",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-muted/50 rounded-md",
                    "group-hover:bg-muted/30"
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={onToggle}
            >
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1">
                        {isExpanded ? (
                            <ChevronDown className="w-3 h-3 transition-transform duration-200" />
                        ) : (
                            <ChevronRight className="w-3 h-3 transition-transform duration-200" />
                        )}
                        <span className="truncate">{category.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground/60">{channelCount}</span>
                        {isHovered && (
                            <Plus className="w-3 h-3 text-muted-foreground/60 hover:text-foreground transition-colors" />
                        )}
                    </div>
                </div>
            </Button>
        </div>
    )
}

const ChannelItem = ({
    channel,
    isActive = false,
    onClick
}: {
    channel: Channel;
    isActive?: boolean;
    onClick?: () => void;
}) => {
    const [isHovered, setIsHovered] = useState(false)

    // Determine channel icon based on type or name
    const getChannelIcon = () => {
        const name = channel.name.toLowerCase()
        if (name.includes('voice') || name.includes('audio')) {
            return Volume2
        }
        if (name.includes('private') || name.includes('mod')) {
            return Lock
        }
        if (name.includes('admin') || name.includes('settings')) {
            return Settings
        }
        return Hash
    }

    const IconComponent = getChannelIcon()

    return (
        <div className="relative group">
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full h-8 px-2 justify-start text-sm transition-all duration-200 relative overflow-hidden",
                    "hover:bg-muted/50 rounded-md",
                    isActive
                        ? "bg-accent/20 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={onClick}
            >
                <div className="flex items-center gap-2 w-full relative z-10">
                    <IconComponent className={cn(
                        "w-4 h-4 transition-all duration-200 flex-shrink-0",
                        isActive
                            ? "text-foreground"
                            : "text-muted-foreground/60 group-hover:text-muted-foreground"
                    )} />
                    <span className="truncate">{channel.name}</span>
                </div>

                {/* Subtle shimmer effect on hover */}
                {isHovered && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                )}
            </Button>
        </div>
    )
}

export default function ChannelList(props: React.HTMLAttributes<HTMLDivElement>) {
    const { servers, activeServerId, activeChannelId, actions } = useServer()
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())

    const server = activeServerId ? servers[activeServerId] : null

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

    // Show DMs when no server is selected
    if (activeServerId === null) {
        return (
            <div
                {...props}
                className={cn(
                    "flex flex-col w-60 h-full relative",
                    "bg-gradient-to-b from-background via-background/95 to-background/90",
                    "border-r border-border/50 backdrop-blur-sm",
                    "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40",
                    // Subtle pattern overlay
                    "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] before:pointer-events-none",
                    props.className
                )}
            >
                {/* Ambient glow at top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-primary/5 rounded-full blur-2xl" />

                <DMsList />

                {/* Ambient glow at bottom */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-12 bg-primary/3 rounded-full blur-xl" />
            </div>
        )
    }

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
                    <div className="text-center">
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
                "border-r border-border/50 backdrop-blur-sm",
                "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40",
                // Subtle pattern overlay
                "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] before:pointer-events-none",
                props.className
            )}
        >
            {/* Ambient glow at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-primary/5 rounded-full blur-2xl" />

            {/* Server name header */}
            <div className="mb-4 p-4 flex flex-col justify-center items-start relative ">
                <h2 className="text-lg font-semibold text-foreground truncate">
                    {server.name}
                </h2>
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent absolute bottom-0" />
            </div>

            {/* Channels content */}
            <div className="flex-1 overflow-y-auto space-y-1 px-2">
                {/* Uncategorized channels */}
                {uncategorizedChannels.length > 0 && (
                    <div className="space-y-0.5 mb-4">
                        {uncategorizedChannels.map((channel) => (
                            <ChannelItem
                                key={channel.channelId}
                                channel={channel}
                                isActive={channel.channelId === activeChannelId}
                                onClick={() => actions.setActiveChannelId(channel.channelId)}
                            />
                        ))}
                    </div>
                )}

                {/* Categorized channels */}
                {categories.map((category) => {
                    const categoryChannels = categorizedChannels.get(category.categoryId) || []
                    const isExpanded = expandedCategories.has(category.categoryId)

                    return (
                        <div key={category.categoryId} className="mb-2">
                            <CategoryHeader
                                category={category}
                                isExpanded={isExpanded}
                                onToggle={() => toggleCategory(category.categoryId)}
                                channelCount={categoryChannels.length}
                            />

                            {isExpanded && (
                                <div className="mt-1 space-y-0.5 ml-2">
                                    {categoryChannels.map((channel) => (
                                        <ChannelItem
                                            key={channel.channelId}
                                            channel={channel}
                                            isActive={channel.channelId === activeChannelId}
                                            onClick={() => actions.setActiveChannelId(channel.channelId)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Ambient glow at bottom */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-12 bg-primary/3 rounded-full blur-xl" />
        </div>
    )
}