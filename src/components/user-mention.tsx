import { useProfile, useServer } from "@/hooks/subspace"
import useSubspace from "@/hooks/subspace"
import { shortenAddress } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ArioBadge from "./ario-badhe";
import { Check, Copy, Shield, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useCallback } from "react";

export default function UserMention({ userId, showAt = true, side = "bottom", align = "center", renderer }:
    { userId: string; showAt?: boolean, side?: "top" | "left" | "bottom" | "right", align?: "start" | "center" | "end", renderer: (text: string) => React.ReactNode }) {
    const subspace = useSubspace()
    const { profiles, actions: profileActions } = useProfile()
    const { activeServerId, servers, actions: serverActions } = useServer()

    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    const server = activeServerId ? servers[activeServerId] : null
    const nickname = server ? server?.members.find(m => m.userId === userId)?.nickname : null
    const member = server ? server?.members.find(m => m.userId === userId) : null

    const profile = profiles[userId]
    const primaryName = profile?.primaryName || null;

    const displayText = nickname || primaryName || shortenAddress(userId)

    // Get user's roles from the server
    const getUserRoles = () => {
        if (!server || !member || !member.roles || !Array.isArray(member.roles)) {
            return []
        }

        // Filter server roles to get only the ones assigned to this user
        return server.roles
            .filter(role => member.roles.includes(role.roleId))
            .sort((a, b) => a.orderId - b.orderId) // Sort by order (higher roles first)
    }

    const userRoles = getUserRoles()

    // Fetch latest data when popover opens
    const handleOpenChange = useCallback(async (open: boolean) => {
        setIsOpen(open)

        if (open && !isRefreshing) {
            setIsRefreshing(true)

            try {
                // Fetch latest profile data and update state
                const latestProfile = await subspace.user.getProfile({ userId })
                if (latestProfile) {
                    profileActions.updateProfile(userId, latestProfile)
                }

                // Fetch latest server data if we're in a server
                if (activeServerId) {
                    // Fetch and update server details (member count, etc.)
                    const latestServerDetails = await subspace.server.getServerDetails({ serverId: activeServerId })
                    if (latestServerDetails) {
                        // Update server with latest details
                        const currentServer = servers[activeServerId]
                        if (currentServer) {
                            const updatedServer = {
                                ...currentServer,
                                ...latestServerDetails
                            }
                            serverActions.updateServer(activeServerId, updatedServer)
                        }
                    }

                    // Fetch and update all server members to ensure fresh member data
                    const latestServerMembers = await subspace.server.getServerMembers({ serverId: activeServerId })
                    if (latestServerMembers) {
                        serverActions.updateServerMembers(activeServerId, latestServerMembers)
                    }

                    // Fetch and update latest roles data to ensure correct ordering and info
                    const latestRoles = await subspace.server.role.getRoles({ serverId: activeServerId })
                    if (latestRoles) {
                        // Update the server with the latest roles
                        const currentServer = servers[activeServerId]
                        if (currentServer) {
                            const updatedServer = {
                                ...currentServer,
                                roles: latestRoles
                            }
                            serverActions.updateServer(activeServerId, updatedServer)
                        }
                    }

                    // Fetch specific user member data to ensure it's the most current
                    const latestMember = await subspace.server.getServerMember({
                        serverId: activeServerId,
                        userId
                    })

                    if (latestMember) {
                        // Update the specific member in the server's member list
                        const currentServer = servers[activeServerId]
                        if (currentServer && currentServer.members) {
                            const updatedMembers = currentServer.members.map(m =>
                                m.userId === userId ? latestMember : m
                            )

                            // If member wasn't found, add them
                            if (!currentServer.members.find(m => m.userId === userId)) {
                                updatedMembers.push(latestMember)
                            }

                            serverActions.updateServerMembers(activeServerId, updatedMembers)
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to refresh user and server data:', error)
            } finally {
                setIsRefreshing(false)
            }
        }
    }, [userId, activeServerId, servers, subspace, profileActions, serverActions, isRefreshing])

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                {renderer(displayText)}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-md" side={side} align={align}>
                {profile ? (
                    <div className="relative overflow-hidden rounded-md">
                        {/* Header with gradient background */}
                        <div className="h-16 bg-gradient-to-r from-primary/30 via-accent to-primary/30 relative">
                            <div className="absolute inset-0 bg-background/10"></div>
                            {/* Refresh indicator */}
                            {isRefreshing && (
                                <div className="absolute top-2 right-2">
                                    <div className="w-6 h-6 rounded-full bg-background/20 backdrop-blur-sm flex items-center justify-center">
                                        <Loader2 className="w-3 h-3 animate-spin text-foreground/70" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile content */}
                        <div className="px-4 pb-4 -mt-8 relative">
                            {/* Avatar with border */}
                            <div className="relative mb-3">
                                {profile.pfp ? (
                                    <img
                                        src={`https://arweave.net/${profile.pfp}`}
                                        alt={profile.primaryName || nickname || shortenAddress(userId)}
                                        className="w-16 h-16 rounded-full border-4 border-card shadow-lg bg-muted"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full border-4 border-card shadow-lg bg-muted flex items-center justify-center">
                                        <span className="text-2xl font-semibold text-muted-foreground">
                                            {(profile.primaryName || nickname || shortenAddress(userId)).charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* User info */}
                            <div className="space-y-2">
                                <div>
                                    <h3 className="text-lg font-bold text-card-foreground leading-tight">
                                        {/* {profile.primaryName || nickname || "Unknown User"} */}
                                        {profile.primaryName ? <div className="flex items-center gap-1">
                                            {profile.primaryName}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <ArioBadge className="w-4.5 h-4.5 cursor-pointer" onClick={() => window.open("https://ar.io", "_blank")} />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right">
                                                        This user has a primary name
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div> : <>{nickname || shortenAddress(userId)}</>}
                                    </h3>
                                    {nickname && profile.primaryName && (
                                        <p className="text-sm text-muted-foreground font-medium">
                                            aka {nickname}
                                        </p>
                                    )}
                                </div>

                                <Separator />

                                {/* User details */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            User ID
                                        </span>
                                        <Badge variant="secondary" className="font-mono text-xs !pointer-events-auto">
                                            {shortenAddress(userId)} <Copy id={`copy-icon-${userId}`} className="w-3 h-3 z-10 !cursor-pointer !pointer-events-auto" onClick={() => {
                                                navigator.clipboard.writeText(userId)
                                                const copyIcon = document.getElementById(`copy-icon-${userId}`);
                                                const checkIcon = document.getElementById(`check-icon-${userId}`);
                                                if (copyIcon && checkIcon) {
                                                    // hide copy icon and show check icon for 2 seconds
                                                    copyIcon.classList.add("hidden");
                                                    checkIcon.classList.remove("hidden");
                                                    setTimeout(() => {
                                                        copyIcon.classList.remove("hidden");
                                                        checkIcon.classList.add("hidden");
                                                    }, 550);
                                                }
                                            }} />
                                            <Check id={`check-icon-${userId}`} className="w-3 h-3 hidden" />
                                        </Badge>
                                    </div>

                                    {/* Display assigned roles */}
                                    {userRoles.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    Roles
                                                </span>
                                                {/* <Shield className="w-3 h-3 text-muted-foreground" /> */}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {userRoles.map((role) => (
                                                    <Badge
                                                        key={role.roleId}
                                                        variant="secondary"
                                                        className="text-xs px-1 py-0.5 flex items-center gap-1.5"
                                                        style={{
                                                            backgroundColor: `${role.color}20`,
                                                            borderColor: `${role.color}40`,
                                                            color: role.color
                                                        }}
                                                    >
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: role.color }}
                                                        />
                                                        <span className="font-medium">{role.name}</span>
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 bg-muted rounded-full mx-auto mb-3 flex items-center justify-center">
                            <span className="text-muted-foreground text-xl">?</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">No profile found</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">This user hasn't set up their profile yet</p>
                        {isRefreshing && (
                            <div className="flex items-center justify-center mt-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="ml-2 text-xs text-muted-foreground">Refreshing...</span>
                            </div>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}