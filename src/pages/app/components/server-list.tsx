import { useServer } from "@/hooks/subspace/server"
import { useState, useEffect, memo } from "react"
import useSubspace, { useProfile, useNotifications } from "@/hooks/subspace"
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet"
import { type Profile, type Server } from "@/types/subspace"
import { Button } from "@/components/ui/button"
import { Download, Home, Plus, Sparkles, Users, WalletCards } from "lucide-react"
import { cn, uploadFileTurbo } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { toast } from "sonner"
import { usePWA } from "@/hooks/use-pwa"
import { JoinServerDialog, type WelcomePopupData } from "@/components/join-server-dialog"

const ServerButton = memo(({ server, isActive = false, onClick }: { server: Server; isActive?: boolean, onClick?: () => void }) => {
    const [isHovered, setIsHovered] = useState(false)
    const { unreadCountsByServer } = useNotifications()

    // Get unread count for this server
    const unreadCount = unreadCountsByServer[server.serverId] || 0

    return (
        <div className="relative group mb-3">
            {/* Glow effect for active state */}
            {isActive && (
                <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl scale-110 animate-pulse" />
            )}

            {/* Active/Hover indicator pill with glow */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isActive
                        ? "h-10 bg-gradient-to-b from-primary via-primary to-primary/80 shadow-lg shadow-primary/50"
                        : isHovered
                            ? "h-6 bg-gradient-to-b from-foreground/80 to-foreground/60 shadow-md shadow-foreground/30"
                            : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        isActive ? "rounded-2xl shadow-lg shadow-primary/20" : "rounded-3xl hover:rounded-2xl hover:shadow-md hover:shadow-foreground/10"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={onClick}
                >
                    <div className={cn(
                        "w-12 h-12 overflow-hidden transition-all duration-300 ease-out relative",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:via-transparent before:to-transparent before:opacity-0 group-hover:before:opacity-100 before:transition-opacity before:duration-300",
                        isActive ? "rounded-2xl" : "rounded-xl group-hover:rounded-2xl"
                    )}>
                        <img
                            src={`https://arweave.net/${server.icon}`}
                            alt={server.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                    </div>
                </Button>

                {/* Mention count badge */}
                {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 z-10">
                        <div className={cn(
                            "flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold text-white rounded-full aspect-square",
                            "bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30",
                            "border border-background/20 backdrop-blur-sm",
                            "transition-all duration-200 ease-out",
                            "animate-in zoom-in-50 duration-300"
                        )}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    </div>
                )}

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full" />
                            <span className="font-medium">{server.name}</span>
                            {unreadCount > 0 && (
                                <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-red-500/10 text-red-600 rounded text-xs">
                                    <span>{unreadCount}</span>
                                    <span className="text-red-500/70">mention{unreadCount !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                        {/* Arrow pointing left */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
})

const HomeButton = memo(({ isActive = false, onClick }: { isActive?: boolean, onClick?: () => void }) => {
    const [isHovered, setIsHovered] = useState(false)
    const actions = useServer(state => state.actions)
    const { unreadCount } = useNotifications()

    return (
        <div className="relative group mb-3">
            {/* Glow effect for active state */}
            {isActive && (
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl scale-110 animate-pulse" />
            )}

            {/* Active/Hover indicator pill with glow */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isActive
                        ? "h-10 bg-gradient-to-b from-primary via-primary to-primary/80 shadow-lg shadow-primary/50"
                        : isHovered
                            ? "h-6 bg-gradient-to-b from-foreground/80 to-foreground/60 shadow-md shadow-foreground/30"
                            : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        isActive
                            ? "rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30"
                            : "rounded-3xl hover:rounded-2xl bg-muted/50 hover:bg-gradient-to-br hover:from-primary hover:to-primary/80 hover:shadow-md hover:shadow-primary/20"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={onClick}
                >
                    {/* <Home className={cn(
                        "w-5 h-5 transition-all duration-300",
                        isActive
                            ? "text-primary-foreground drop-shadow-sm"
                            : "text-muted-foreground group-hover:text-primary-foreground group-hover:scale-110"
                    )} /> */}

                    <img
                        src="/s.png"
                        alt="Home"
                        className={cn(
                            "w-10 h-10 object-cover transition-all duration-300 rounded-lg",
                            isActive
                                ? "drop-shadow-sm scale-100"
                                : "group-hover:scale-110 opacity-90 group-hover:opacity-100"
                        )}
                    />

                    {/* Sparkle effect for active state */}
                    {/* {isActive && (
                        <Sparkles className="absolute top-1 right-1 w-3 h-3 text-primary-foreground/60 animate-pulse" />
                    )} */}
                </Button>

                {/* Mention count badge */}
                {/* will be useful when dms are implemented */}
                {/* {(
                    <div className="absolute -top-1 -right-1 z-10">
                        <div className={cn(
                            "flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold text-white rounded-full",
                            "bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30",
                            "border border-background/20 backdrop-blur-sm",
                            "transition-all duration-200 ease-out",
                            "animate-in zoom-in-50 duration-300"
                        )}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    </div>
                )} */}

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <Home className="w-3 h-3 text-primary" />
                            <span className="font-medium">Home</span>
                            {/* { will be useful when dms are implemented */}
                            {/* {(
                                <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-red-500/10 text-red-600 rounded text-xs">
                                    <span>{unreadCount}</span>
                                    <span className="text-red-500/70">mention{unreadCount !== 1 ? 's' : ''}</span>
                                </div>
                            )} */}
                        </div>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
})

const sampleInvites = [
    "wLedDuEphwwvxLS-ftFb4mcXhqu4jwkYtIM4txCx2V8",
    "subspace.ar.io/#/invite/wLedDuEphwwvxLS-ftFb4mcXhqu4jwkYtIM4txCx2V8"
]

const AddServerButton = ({ onServerJoined }: { onServerJoined?: (data: WelcomePopupData) => void }) => {
    const [isHovered, setIsHovered] = useState(false)
    const [joinDialogOpen, setJoinDialogOpen] = useState(false)
    const [popoverOpen, setPopoverOpen] = useState(false)

    // Create server state
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [serverName, setServerName] = useState("")
    const [serverIcon, setServerIcon] = useState<File | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [createError, setCreateError] = useState("")

    const subspace = useSubspace()
    const { address, jwk, connectionStrategy } = useWallet()
    const { actions: serverActions, serversJoined } = useServer()

    const handleCreateServer = async () => {
        if (!serverName.trim()) {
            setCreateError("Please enter a server name")
            return
        }

        if (!address) {
            setCreateError("Please connect your wallet first")
            return
        }

        setIsCreating(true)
        setCreateError("")

        try {
            var iconId: string | undefined

            // Upload icon if provided
            if (serverIcon) {
                toast.loading("Uploading server icon...", {
                    richColors: true,
                    style: {
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                        backdropFilter: "blur(8px)"
                    },
                    className: "font-medium",
                    duration: Infinity
                })

                try {
                    iconId = await (connectionStrategy == ConnectionStrategies.ScannedJWK ? uploadFileTurbo(serverIcon, jwk) : uploadFileTurbo(serverIcon))
                    toast.dismiss()
                    toast.success("Icon uploaded successfully", {
                        richColors: true,
                        style: {
                            backgroundColor: "var(--background)",
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            boxShadow: "0 10px 25px -5px rgba(34, 197, 94, 0.15), 0 4px 6px -2px rgba(34, 197, 94, 0.1)",
                            backdropFilter: "blur(8px)"
                        },
                        className: "font-medium",
                        duration: 3000
                    })
                } catch (error) {
                    console.error("Error uploading icon:", error)
                    toast.dismiss()
                    toast.error("Failed to upload icon. Creating server without icon.", {
                        richColors: true,
                        style: {
                            backgroundColor: "var(--background)",
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.15), 0 4px 6px -2px rgba(239, 68, 68, 0.1)",
                            backdropFilter: "blur(8px)"
                        },
                        className: "font-medium",
                        duration: 4000
                    })
                    iconId = undefined
                }
            }

            // Create the server
            toast.loading("Creating server... Don't close this window!", {
                richColors: true,
                style: {
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    backdropFilter: "blur(8px)"
                },
                className: "font-medium",
                duration: Infinity
            })

            console.log("Creating server with icon:", iconId)

            const serverId = await subspace.server.createServer({
                name: serverName.trim(),
                icon: iconId
            })

            toast.dismiss()

            if (serverId) {
                toast.success("Server created successfully!", {
                    richColors: true,
                    style: {
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px -5px rgba(34, 197, 94, 0.15), 0 4px 6px -2px rgba(34, 197, 94, 0.1)",
                        backdropFilter: "blur(8px)"
                    },
                    className: "font-medium",
                    duration: 4000
                })

                // Join the server automatically
                try {
                    const joinSuccess = await subspace.user.joinServer({ serverId })
                    if (!joinSuccess) {
                        console.warn("Failed to join the created server automatically")
                        toast.warning("Server created but failed to join automatically. You may need to join manually.", {
                            richColors: true,
                            style: {
                                backgroundColor: "var(--background)",
                                color: "var(--foreground)",
                                border: "1px solid var(--border)",
                                borderRadius: "12px",
                                boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.15), 0 4px 6px -2px rgba(245, 158, 11, 0.1)",
                                backdropFilter: "blur(8px)"
                            },
                            className: "font-medium",
                            duration: 5000
                        })
                    }
                } catch (error) {
                    console.error("Error joining created server:", error)
                    toast.warning("Server created but failed to join automatically. You may need to join manually.", {
                        richColors: true,
                        style: {
                            backgroundColor: "var(--background)",
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.15), 0 4px 6px -2px rgba(245, 158, 11, 0.1)",
                            backdropFilter: "blur(8px)"
                        },
                        className: "font-medium",
                        duration: 5000
                    })
                }

                // Update the local state to include the new server
                const currentServers = Array.isArray(serversJoined[address]) ? serversJoined[address] : []
                if (!currentServers.includes(serverId)) {
                    serverActions.setServersJoined(address, [...currentServers, serverId])
                }

                // Fetch server details to get the complete server object
                try {
                    const serverDetails = await subspace.server.getServerDetails({ serverId })
                    if (serverDetails) {
                        const server: Server = {
                            serverId,
                            ...serverDetails
                        }
                        serverActions.addServer(server)

                        // Set as active server
                        serverActions.setActiveServerId(serverId)

                        // Show welcome popup if callback provided
                        if (onServerJoined) {
                            onServerJoined({
                                serverId,
                                serverName: serverDetails.name || `Server ${serverId.substring(0, 8)}...`,
                                memberCount: serverDetails.member_count || 0
                            })
                        }
                    }
                } catch (error) {
                    console.warn("Failed to fetch server details:", error)
                }

                // Reset form and close dialog
                setServerName("")
                setServerIcon(null)
                setCreateDialogOpen(false)
                setCreateError("")

                if (onServerJoined) {
                    onServerJoined({
                        serverId,
                        serverName: `Server ${serverId.substring(0, 8)}...`,
                        memberCount: 0
                    })
                }
            } else {
                setCreateError("Failed to create server. Please try again.")
            }
        } catch (error) {
            console.error("Error creating server:", error)
            toast.dismiss()
            setCreateError(error instanceof Error ? error.message : "Failed to create server. Please try again.")
        } finally {
            setIsCreating(false)
        }
    }

    // Create server validation
    const isValidServerName = serverName.trim().length > 0
    const isValidForCreation = isValidServerName

    return (
        <div className="relative group mb-3">
            {/* Hover indicator pill */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isHovered
                        ? "h-6 bg-gradient-to-b from-green-500/80 to-green-400/60 shadow-md shadow-green-500/30"
                        : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                                "rounded-3xl hover:rounded-2xl bg-muted/30 hover:bg-gradient-to-br hover:from-green-500 hover:to-green-400 hover:shadow-md hover:shadow-green-500/20",
                                "border-2 border-dashed border-muted-foreground/30 hover:border-green-400/50"
                            )}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            <Plus className={cn(
                                "w-5 h-5 transition-all duration-300",
                                "text-muted-foreground group-hover:text-white group-hover:scale-110 group-hover:rotate-90"
                            )} />

                            {/* Shimmer effect on hover */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-72 p-0 shadow-xl border-border/50">
                        <div className="relative overflow-hidden rounded-lg">
                            {/* Header with gradient background */}
                            <div className="px-4 py-3 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-b border-border/50">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-primary" />
                                    Server Actions
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">Join an existing server or create your own</p>
                            </div>

                            {/* Action buttons */}
                            <div className="p-2 space-y-2">
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full h-12 p-2.5 justify-start text-left transition-all duration-200 group relative overflow-hidden",
                                        "hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-blue-400/5",
                                        "border border-border/30 hover:border-blue-400/30",
                                        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-blue-500/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                                    )}
                                    onClick={() => {
                                        setJoinDialogOpen(true)
                                    }}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                            <Users className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-foreground">Join Server</div>
                                            <div className="text-xs text-muted-foreground">Connect to an existing community</div>
                                        </div>
                                    </div>
                                </Button>

                                <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full h-12 p-2.5 justify-start text-left transition-all duration-200 group relative overflow-hidden",
                                                "hover:bg-gradient-to-r hover:from-green-500/10 hover:to-green-400/5",
                                                "border border-border/30 hover:border-green-400/30",
                                                "before:absolute before:inset-0 before:bg-gradient-to-r before:from-green-500/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                                            )}
                                            onClick={() => {
                                                setServerName("")
                                                setServerIcon(null)
                                                setCreateError("")
                                                // Don't close popover automatically
                                            }}
                                        >
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                                                    <Plus className="w-4 h-4 text-green-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm text-foreground">Create Server</div>
                                                    <div className="text-xs text-muted-foreground">Start your own community</div>
                                                </div>
                                            </div>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="max-w-lg w-[95vw] sm:w-full p-0 max-h-[90vh] overflow-hidden flex flex-col">
                                        <div className="relative overflow-hidden flex-shrink-0">
                                            {/* Header with gradient */}
                                            <AlertDialogHeader className="relative px-4 sm:px-6 pt-6 pb-4">
                                                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-t-lg" />
                                                <AlertDialogTitle className="text-xl font-bold flex items-center gap-3 relative">
                                                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                                        <Plus className="w-5 h-5 text-green-500" />
                                                    </div>
                                                    <div>
                                                        <div>Create Server</div>
                                                        <div className="text-sm font-normal text-muted-foreground mt-1">
                                                            Start your own community
                                                        </div>
                                                    </div>
                                                </AlertDialogTitle>
                                            </AlertDialogHeader>

                                            <AlertDialogDescription asChild>
                                                <div className="px-4 sm:px-6 space-y-6 mt-4 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        {/* Server Icon Upload */}
                                                        <div className="w-full sm:w-1/3">
                                                            <FileDropzone
                                                                onFileChange={setServerIcon}
                                                                label="Server Icon"
                                                                placeholder="Upload icon"
                                                                accept={{ 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] }}
                                                                previewType="square"
                                                            />
                                                        </div>

                                                        {/* Server Details */}
                                                        <div className="flex-1 space-y-4">
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium text-foreground">
                                                                    Server Name *
                                                                </label>
                                                                <Input
                                                                    type="text"
                                                                    placeholder="My Awesome Server"
                                                                    value={serverName}
                                                                    onChange={(e) => {
                                                                        setServerName(e.target.value)
                                                                        setCreateError("")
                                                                    }}
                                                                    className={cn(
                                                                        "transition-all duration-200",
                                                                        createError && !serverName.trim()
                                                                            ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                                                            : isValidServerName
                                                                                ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                                                                                : ""
                                                                    )}
                                                                    disabled={isCreating}
                                                                />
                                                                {isValidServerName && (
                                                                    <p className="text-sm text-green-600 flex items-center gap-2">
                                                                        <div className="w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center">
                                                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                                                        </div>
                                                                        Valid server name
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Server Description */}
                                                            <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                                                                <h4 className="text-sm font-medium text-foreground mb-2">What happens next:</h4>
                                                                <ul className="text-xs text-muted-foreground space-y-1">
                                                                    <li className="flex items-start gap-2">
                                                                        <div className="w-1 h-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                                                        <span>Your server will be created on the Arweave network</span>
                                                                    </li>
                                                                    <li className="flex items-start gap-2">
                                                                        <div className="w-1 h-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                                                        <span>You'll be the server owner with full permissions</span>
                                                                    </li>
                                                                    <li className="flex items-start gap-2">
                                                                        <div className="w-1 h-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                                                        <span>You can invite others and create channels</span>
                                                                    </li>
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {createError && (
                                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                                            <p className="text-sm text-red-600 flex items-center gap-2">
                                                                <div className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center">
                                                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                                                </div>
                                                                {createError}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </AlertDialogDescription>

                                            <AlertDialogFooter className="px-4 sm:px-6 pb-6 pt-4 gap-3 flex-shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-sm">
                                                <AlertDialogCancel disabled={isCreating}>
                                                    Cancel
                                                </AlertDialogCancel>
                                                <Button
                                                    onClick={handleCreateServer}
                                                    disabled={!isValidForCreation || isCreating}
                                                    className={cn(
                                                        "min-w-[120px] transition-all duration-200",
                                                        "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
                                                        "shadow-lg shadow-green-500/25 hover:shadow-green-500/40",
                                                        "disabled:opacity-50 disabled:cursor-not-allowed"
                                                    )}
                                                >
                                                    {isCreating ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            <span>Creating...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <Plus className="w-4 h-4" />
                                                            <span>Create Server</span>
                                                        </div>
                                                    )}
                                                </Button>
                                            </AlertDialogFooter>
                                        </div>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <Plus className="w-3 h-3 text-green-500" />
                            <span className="font-medium">Add Server</span>
                        </div>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>

            {/* Join Server Dialog */}
            <JoinServerDialog
                open={joinDialogOpen}
                onOpenChange={setJoinDialogOpen}
                onServerJoined={onServerJoined}
            />
        </div>
    )
}

const InstallPWAButton = () => {
    const [isHovered, setIsHovered] = useState(false)
    const { showInstallPrompt, isInstallable, isInstalled, debugInfo } = usePWA()

    // Don't show the button if the app is already installed
    if (isInstalled) {
        return null
    }

    const handleInstallClick = async () => {
        console.log('Install button clicked, isInstallable:', isInstallable)
        console.log('Debug info:', debugInfo)

        if (!isInstallable) {
            // Show debug information to help troubleshoot
            toast.error("Install not available", {
                description: `Debug: SW=${debugInfo.hasServiceWorker}, Manifest=${debugInfo.hasManifest}, Secure=${debugInfo.isSecure}`,
                richColors: true,
                style: {
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.15), 0 4px 6px -2px rgba(239, 68, 68, 0.1)",
                    backdropFilter: "blur(8px)"
                },
                className: "font-medium",
                duration: 5000
            })
            return
        }

        await showInstallPrompt()
    }

    return (
        <div className="relative group mb-3">
            {/* Hover indicator pill */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isHovered
                        ? "h-6 bg-gradient-to-b from-primary/80 to-primary/60 shadow-md shadow-primary/30"
                        : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        "rounded-3xl hover:rounded-2xl bg-muted/30 hover:bg-gradient-to-br hover:from-primary hover:to-primary/80 hover:shadow-md hover:shadow-primary/20",
                        !isInstallable && "opacity-50 cursor-not-allowed"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={handleInstallClick}
                    disabled={!isInstallable}
                >
                    <Download className={cn(
                        "w-5 h-5 transition-all duration-300",
                        "text-muted-foreground group-hover:text-primary-foreground group-hover:scale-110 group-hover:-translate-y-0.5"
                    )} />

                    {/* Shimmer effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                </Button>

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <Download className="w-3 h-3 text-primary" />
                            <span className="font-medium">
                                {isInstallable ? "Install App" : "Install Unavailable"}
                            </span>
                        </div>
                        {!isInstallable && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Check console for details
                            </div>
                        )}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
}

const WalletButton = () => {
    const [isHovered, setIsHovered] = useState(false)
    const { address, wanderInstance } = useWallet()

    return (
        <div className="relative group mb-3">
            {/* Hover indicator pill */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isHovered
                        ? "h-6 bg-gradient-to-b from-primary/80 to-primary/60 shadow-md shadow-primary/30"
                        : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        "rounded-3xl hover:rounded-2xl bg-muted/30 hover:bg-gradient-to-br hover:from-primary hover:to-primary/80 hover:shadow-md hover:shadow-primary/20"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={() => {
                        // Add wallet functionality here
                        wanderInstance.open()
                    }}
                >
                    <WalletCards className={cn(
                        "w-5 h-5 transition-all duration-300",
                        "text-muted-foreground group-hover:text-primary-foreground group-hover:scale-110"
                    )} />

                    {/* Shimmer effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                </Button>

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <WalletCards className="w-3 h-3 text-primary" />
                            <span className="font-medium">Wallet</span>
                            {address && (
                                <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded text-xs">
                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    <span>Connected</span>
                                </div>
                            )}
                        </div>
                        {address && (
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                                {address.substring(0, 6)}...{address.substring(address.length - 4)}
                            </div>
                        )}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function ServerList(props: React.HTMLAttributes<HTMLDivElement> & { onServerJoined?: (data: WelcomePopupData) => void }) {
    const { address, connectionStrategy, connected } = useWallet()
    const { servers, actions, activeServerId, serversJoined, loadingServers } = useServer()
    const profiles = useProfile(state => state.profiles)
    const { onServerJoined, ...divProps } = props

    const myProfile: Profile = address ? profiles[address] : null
    const myServers = myProfile?.serversJoined ? myProfile?.serversJoined : []


    return (
        <div
            {...divProps}
            className={cn(
                "flex flex-col w-[72px] h-full py-4 pb-2 px-3 relative z-10",
                "bg-gradient-to-b from-background via-background/95 to-background/90",
                "border-r border-border/50 backdrop-blur-sm",
                "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40",
                // Subtle pattern overlay
                "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] before:pointer-events-none",
                props.className
            )}
        >
            {/* Ambient glow at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />

            {/* Home Button */}
            <HomeButton isActive={activeServerId === ""} onClick={() => { actions.setActiveServerId(""); actions.setActiveChannelId(0) }} />

            {/* Enhanced Separator with gradient */}
            <div className="relative mx-auto mb-3">
                <div className="w-8 h-[2px] bg-gradient-to-r from-transparent via-border to-transparent rounded-full" />
                <div className="absolute inset-0 w-8 h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-full blur-sm" />
            </div>

            {/* Server Buttons */}
            <div className="space-y-1 overflow-visible">
                {/* {Object.values(servers).filter((server) => serversJoined[server.serverId]).map((server, index) => (
                    <div
                        key={server.serverId}
                        style={{ animationDelay: `${index * 100}ms` }}
                        className="animate-in slide-in-from-left-5 fade-in duration-500"
                    >
                        <ServerButton server={server} isActive={server.serverId === activeServerId} onClick={() => actions.setActiveServerId(server.serverId)} />
                    </div>
                ))} */}
                {
                    serversJoined
                    && serversJoined[address]
                    && serversJoined[address].length > 0
                    && serversJoined[address].map((serverId, index) => (
                        servers[serverId] && (
                            <div
                                key={serverId}
                                style={{ animationDelay: `${index * 100}ms` }}
                                className="animate-in slide-in-from-left-5 fade-in duration-500"
                            >
                                <ServerButton server={servers[serverId]} isActive={serverId === activeServerId} onClick={() => actions.setActiveServerIdAndRestoreChannel(serverId)} />
                            </div>
                        )
                    ))
                }
                {/* Skeleton loaders for servers being loaded */}
                {(() => {
                    // Get the list of server IDs that should be loaded
                    const expectedServerIds = Array.isArray(serversJoined[address]) ? serversJoined[address] : [];

                    // Count how many servers have actually been loaded (have data in servers object)
                    const loadedServersCount = expectedServerIds.filter(serverId => servers[serverId]).length;

                    // Show skeletons for servers that are expected but not yet loaded
                    const skeletonsToShow = loadingServers ? Math.max(0, expectedServerIds.length - loadedServersCount) : 0;

                    // console.log('Skeleton Debug:', {
                    //     expectedServerIds: expectedServerIds.length,
                    //     loadedServersCount,
                    //     skeletonsToShow,
                    //     loadingServers
                    // });

                    return Array.from({ length: skeletonsToShow }, (_, index) => (
                        <div
                            key={`skeleton-${index}`}
                            className="relative group mb-3 animate-in slide-in-from-left-5 fade-in duration-500"
                            style={{ animationDelay: `${(loadedServersCount + index) * 100}ms` }}
                        >
                            {/* Skeleton glow effect */}
                            <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-110 animate-pulse" />

                            <div className="flex justify-center relative">
                                <div className="w-12 h-12 p-0 rounded-3xl bg-muted/50 relative overflow-hidden animate-pulse">
                                    {/* Skeleton shimmer effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent -translate-x-full animate-shimmer" />

                                    {/* Skeleton content */}
                                    <div className="w-full h-full rounded-xl bg-muted/30 flex items-center justify-center">
                                        <div className="w-6 h-6 bg-muted-foreground/20 rounded animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ));
                })()}
            </div>

            <AddServerButton onServerJoined={onServerJoined} />
            <div className="grow" />

            {connected && (connectionStrategy === ConnectionStrategies.WanderConnect) && <WalletButton />}

            <InstallPWAButton />

            {/* @ts-ignore */}
            <div className="h-5 text-xs text-muted-foreground/40 mx-auto text-center">v{__VERSION__}</div>
        </div>
    )
}