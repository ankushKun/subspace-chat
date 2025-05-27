import { useServer } from "@/hooks/subspace/server"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Hash, Volume2, Lock, Settings, Plus, Link, LogOut, Trash2, Edit, Code } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Category, Channel, Server } from "@/types/subspace"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import useSubspace from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { Constants } from "@/lib/constants"
import UserProfile from "./user-profile"



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

const ServerHeader = ({ server }: { server: Server }) => {
    const [leaveServerOpen, setLeaveServerOpen] = useState(false)
    const [isLeavingServer, setIsLeavingServer] = useState(false)
    const subspace = useSubspace()
    const { address } = useWallet()
    const { actions } = useServer()

    const handleCopyInvite = () => {
        const inviteLink = `${window.location.origin}/invite/${server.serverId}`
        navigator.clipboard.writeText(inviteLink)
        toast.success("Invite link copied to clipboard")
    }

    const handleUpdateServerCode = async () => {
        if (!server.serverId) {
            toast.error("No server ID found")
            return
        }

        // Show confirmation toast with action buttons
        toast.custom((t) => (
            <div className="flex items-center gap-4 bg-accent border border-border backdrop-blur-sm p-4 rounded-lg">
                <Code className="w-5 h-5 text-green-500" />
                <div className="flex-1">
                    <p className="font-medium">Update Server Code</p>
                    <p className="text-sm text-muted-foreground">
                        This will update the server to the latest version. Are you sure?
                    </p>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Button
                        size="sm"
                        onClick={async () => {
                            toast.dismiss(t)

                            try {
                                toast.loading("Updating server code...", {
                                    richColors: true,
                                    style: { backgroundColor: "var(--background)", color: "var(--foreground)" }
                                })

                                const success = await subspace.server.updateServerCode({
                                    serverId: server.serverId
                                })

                                toast.dismiss()

                                if (success) {
                                    toast.success("Server code updated successfully", {
                                        richColors: true,
                                        style: { backgroundColor: "var(--background)", color: "var(--foreground)" }
                                    })
                                    const updatedServer = await subspace.server.getServerDetails({ serverId: server.serverId })
                                    if (updatedServer) {
                                        actions.updateServer(server.serverId, updatedServer as Server)
                                    }
                                } else {
                                    toast.error("Failed to update server code", { richColors: true })
                                }
                            } catch (error) {
                                console.error("Error updating server code:", error)
                                toast.dismiss()
                                toast.error(error instanceof Error ? error.message : "Failed to update server code")
                            }
                        }}
                    >
                        Update
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toast.dismiss(t)}>
                        Cancel
                    </Button>
                </div>
            </div>
        ), {
            duration: Infinity, // Keep the toast open until user interacts
        })
    }

    const handleLeaveServer = async () => {
        if (!server.serverId || !address) {
            toast.error("Unable to leave server")
            return
        }

        setIsLeavingServer(true)

        try {
            const success = await subspace.user.leaveServer({ serverId: server.serverId })

            if (success) {
                // Update local state
                const { serversJoined } = useServer.getState()
                const currentServers = serversJoined[address] || []
                const updatedServers = currentServers.filter(id => id !== server.serverId)
                actions.setServersJoined(address, updatedServers)
                actions.removeServer(server.serverId)

                // Reset active server
                actions.setActiveServerId("")
                actions.setActiveChannelId(0)

                toast.success("Left server successfully")
                setLeaveServerOpen(false)
            } else {
                toast.error("Failed to leave server")
            }
        } catch (error) {
            console.error("Error leaving server:", error)
            toast.error("Failed to leave server")
        } finally {
            setIsLeavingServer(false)
        }
    }

    const isOwner = server.owner === address

    return (
        <>
            <div className="mb-4 p-0 flex flex-col justify-center items-center relative">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="w-full cursor-pointer p-4 px-6 hover:bg-muted/30 transition-colors rounded-md ">
                            <div className="flex items-center justify-between w-full">
                                <h2 className="text-lg font-semibold text-foreground truncate">
                                    {server.name}
                                </h2>
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="center"
                        className="w-64 p-2 space-y-1 bg-background/95 backdrop-blur-sm border border-border/50"
                        sideOffset={4}
                    >
                        {/* Copy Invite Link */}
                        <DropdownMenuItem
                            onClick={handleCopyInvite}
                            className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md transition-colors"
                        >
                            <Link className="h-4 w-4 text-blue-500" />
                            <div>
                                <p className="font-medium">Copy Invite Link</p>
                                <p className="text-xs text-muted-foreground">Share this server with others</p>
                            </div>
                        </DropdownMenuItem>

                        {/* Edit Server Details - Only for owner */}
                        {isOwner && (
                            <DropdownMenuItem
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md transition-colors"
                            >
                                <Edit className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Edit Server Details</p>
                                    <p className="text-xs text-muted-foreground">Change name and icon</p>
                                </div>
                            </DropdownMenuItem>
                        )}

                        {/* Update Server Code - Only for owner */}
                        {isOwner && (
                            <DropdownMenuItem
                                onClick={handleUpdateServerCode}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md transition-colors"
                            >
                                <Code className="h-4 w-4 text-green-500" />
                                <div>
                                    <p className="font-medium">Update Server Code</p>
                                    <p className="text-xs text-muted-foreground">Update to latest version</p>
                                </div>
                            </DropdownMenuItem>
                        )}

                        {/* Separator */}
                        <DropdownMenuSeparator className="my-2" />

                        {/* Leave/Delete Server */}
                        <DropdownMenuItem
                            onClick={() => setLeaveServerOpen(true)}
                            className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-destructive/10 rounded-md transition-colors text-destructive"
                        >
                            {isOwner ? (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    <div>
                                        <p className="font-medium">Delete Server</p>
                                        <p className="text-xs text-muted-foreground">Permanently delete this server</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <LogOut className="h-4 w-4" />
                                    <div>
                                        <p className="font-medium">Leave Server</p>
                                        <p className="text-xs text-muted-foreground">You can rejoin with an invite</p>
                                    </div>
                                </>
                            )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent absolute bottom-0" />
            </div>

            {/* Leave/Delete Server Confirmation Dialog */}
            <AlertDialog open={leaveServerOpen} onOpenChange={setLeaveServerOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isOwner ? "Delete Server" : "Leave Server"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isOwner
                                ? "Are you sure you want to delete this server? This action cannot be undone and all data will be permanently lost."
                                : "Are you sure you want to leave this server? You'll need a new invite to join again."
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLeavingServer}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLeaveServer}
                            disabled={isLeavingServer}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isLeavingServer ? (
                                "Processing..."
                            ) : (
                                isOwner ? "Delete Server" : "Leave Server"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
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

                {/* DM Content Area - placeholder for future DM list */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                        <Hash className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Direct Messages</p>
                        <p className="text-xs mt-1">Coming soon...</p>
                    </div>
                </div>

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
            <ServerHeader server={server} />

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