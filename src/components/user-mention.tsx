import { useProfile, useServer } from "@/hooks/subspace"
import useSubspace from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { shortenAddress } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ArioBadge from "./ario-badhe";
import { Check, Copy, Shield, Loader2, Plus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";

export default function UserMention({ userId, showAt = true, side = "bottom", align = "center", renderer }:
    { userId: string; showAt?: boolean, side?: "top" | "left" | "bottom" | "right", align?: "start" | "center" | "end", renderer: (text: string) => React.ReactNode }) {
    const subspace = useSubspace()
    const { address } = useWallet()
    const { profiles, actions: profileActions } = useProfile()
    const { activeServerId, servers, actions: serverActions } = useServer()

    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [rolePopoverOpen, setRolePopoverOpen] = useState(false)
    const [assigningRole, setAssigningRole] = useState(false)
    const [removingRoles, setRemovingRoles] = useState<number[]>([])

    const server = activeServerId ? servers[activeServerId] : null
    const nickname = server ? server?.members.find(m => m.userId === userId)?.nickname : null
    const member = server ? server?.members.find(m => m.userId === userId) : null

    // Check if current user is server owner
    const isServerOwner = server?.owner === address

    const profile = profiles[userId]
    const primaryName = profile?.primaryName || null;

    const displayText = nickname || primaryName || shortenAddress(userId)

    // Get user's roles from the server
    const getUserRoles = () => {
        if (!server || !member || !member.roles || !Array.isArray(member.roles)) {
            return []
        }

        if (!server.roles) {
            return []
        }

        // Filter server roles to get only the ones assigned to this user
        return server.roles
            .filter(role => member.roles.includes(role.roleId))
            .sort((a, b) => a.orderId - b.orderId) // Sort by order (higher roles first)
    }

    // Get available roles for assignment (roles the user doesn't have)
    const getAvailableRoles = () => {
        if (!server || !server.roles || !member) {
            return []
        }

        const userRoleIds = member.roles || []
        return server.roles
            .filter(role => !userRoleIds.includes(role.roleId))
            .sort((a, b) => a.orderId - b.orderId)
    }

    const userRoles = getUserRoles()
    const availableRoles = getAvailableRoles()

    // Handle role assignment
    const handleAssignRole = async (roleId: number) => {
        if (!server || !activeServerId) {
            toast.error("Server not found")
            return
        }

        setAssigningRole(true)
        try {
            const success = await subspace.server.role.assignRole({
                serverId: activeServerId,
                userId: userId,
                roleId: roleId
            })

            if (success) {
                const roleName = server.roles?.find(r => r.roleId === roleId)?.name || "Unknown Role"
                toast.success(`Successfully assigned ${roleName} role`)
                setRolePopoverOpen(false)

                // Refresh the member data to reflect the new role
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
                        serverActions.updateServerMembers(activeServerId, updatedMembers)
                    }
                }
            } else {
                toast.error("Failed to assign role")
            }
        } catch (error) {
            console.error("Error assigning role:", error)
            toast.error("Failed to assign role")
        } finally {
            setAssigningRole(false)
        }
    }

    // Handle role removal
    const handleRemoveRole = async (roleId: number) => {
        if (!server || !activeServerId) {
            toast.error("Server not found")
            return
        }

        setRemovingRoles(prev => [...prev, roleId])
        try {
            const success = await subspace.server.role.unassignRole({
                serverId: activeServerId,
                userId: userId,
                roleId: roleId
            })

            if (success) {
                const roleName = server.roles?.find(r => r.roleId === roleId)?.name || "Unknown Role"
                toast.success(`Successfully removed ${roleName} role`)

                // Refresh the member data to reflect the role removal
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
                        serverActions.updateServerMembers(activeServerId, updatedMembers)
                    }
                }
            } else {
                toast.error("Failed to remove role")
            }
        } catch (error) {
            console.error("Error removing role:", error)
            toast.error("Failed to remove role")
        } finally {
            setRemovingRoles(prev => prev.filter(id => id !== roleId))
        }
    }

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
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                Roles
                                            </span>
                                            {/* Only show the add role button to server owners */}
                                            {isServerOwner && (
                                                <Popover open={rolePopoverOpen} onOpenChange={setRolePopoverOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="w-4.5 h-4.5 hover:bg-primary/10"
                                                            disabled={assigningRole}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setRolePopoverOpen(true)
                                                            }}
                                                        >
                                                            {assigningRole ? (
                                                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                                            ) : (
                                                                <Plus className="w-3 h-3 text-muted-foreground" />
                                                            )}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-64 p-2"
                                                        side="right"
                                                        align="start"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="space-y-2">
                                                            <div className="px-2 py-1">
                                                                <h4 className="text-sm font-semibold">Assign Role</h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Select a role to assign to this user
                                                                </p>
                                                            </div>
                                                            <Separator />
                                                            <div className="max-h-48 overflow-y-auto space-y-1">
                                                                {availableRoles.length > 0 ? (
                                                                    availableRoles.map((role) => (
                                                                        <Button
                                                                            key={role.roleId}
                                                                            variant="ghost"
                                                                            className="w-full justify-start h-auto p-2 text-left"
                                                                            onClick={() => handleAssignRole(role.roleId)}
                                                                            disabled={assigningRole}
                                                                        >
                                                                            <div className="flex items-center gap-2 w-full">
                                                                                <div
                                                                                    className="w-3 h-3 rounded-full border border-border/50 flex-shrink-0"
                                                                                    style={{ backgroundColor: role.color }}
                                                                                />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="font-medium text-sm truncate">
                                                                                        {role.name}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </Button>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-2 py-4 text-center">
                                                                        <p className="text-sm text-muted-foreground">
                                                                            No roles available to assign
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground/70 mt-1">
                                                                            This user already has all available roles
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(userRoles.length > 0) ? userRoles.map((role) => (
                                                <div key={role.roleId} className="group relative">
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs px-1 py-0.5 flex items-center justify-center gap-1.5"
                                                        style={{
                                                            backgroundColor: `${role.color}20`,
                                                            borderColor: `${role.color}40`,
                                                            color: role.color
                                                        }}
                                                    >
                                                        {/* Color dot with X button overlay */}
                                                        <div className="relative w-2.5 h-2.5 flex-shrink-0 flex items-center justify-center">
                                                            {/* Default color dot */}
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full absolute inset-0 group-hover:opacity-0 transition-opacity"
                                                                style={{ backgroundColor: role.color }}
                                                            />
                                                            {/* X button - only visible on hover for server owners */}
                                                            {isServerOwner && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleRemoveRole(role.roleId)
                                                                    }}
                                                                    disabled={removingRoles.includes(role.roleId)}
                                                                    className="absolute p-0 inset-0 w-2.5 h-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                                                    title="Remove role"
                                                                >
                                                                    {removingRoles.includes(role.roleId) ? (
                                                                        <Loader2 className="w-1.5 h-1.5 animate-spin text-white" />
                                                                    ) : (
                                                                        <X className="!w-2.5 !h-2.5 text-white" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <span className="font-medium">{role.name}</span>
                                                    </Badge>
                                                </div>
                                            )) : <p className="text-xs text-muted-foreground/70">No roles assigned</p>}
                                        </div>
                                    </div>
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