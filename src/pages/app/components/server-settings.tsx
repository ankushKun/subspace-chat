import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Link, Plus, Hash, Settings, Code, Trash2, Loader2, X, User, Shield, Upload, Pencil, Eye, GripVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { toast } from "sonner"
import useSubspace from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import { useProfile } from "@/hooks/subspace"
import { uploadFileAR, cn } from "@/lib/utils"
import type { Server, Role, ServerMember, Member } from "@/types/subspace"
import { Permission, getPermissions, hasPermission } from "@/types/subspace"

interface ServerSettingsProps {
    server: Server
    isServerOwner: boolean
    onCreateCategory: () => void
    onCreateChannel: (categoryId?: number) => void
}

// Add MemberAvatar component
const MemberAvatar = ({
    userId,
    size = "sm"
}: {
    userId: string;
    size?: "xs" | "sm" | "md";
}) => {
    const { profiles } = useProfile()
    const profile = profiles[userId]

    const sizeClasses = {
        xs: "w-6 h-6",
        sm: "w-8 h-8",
        md: "w-10 h-10"
    }

    return (
        <div className="relative flex-shrink-0">
            <div className={cn(
                "relative rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center",
                sizeClasses[size]
            )}>
                {profile?.pfp ? (
                    <img
                        src={`https://arweave.net/${profile.pfp}`}
                        alt={userId}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-primary font-semibold text-xs">
                        {(profile?.primaryName || userId).charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
        </div>
    )
}

// Add helper function to get display name
const getDisplayName = (member: ServerMember | Member, profiles: Record<string, any>) => {
    const profile = profiles[member.userId]
    return member.nickname || profile?.primaryName || member.userId
}

// Add helper function to sort members - separate functions for different types
const sortServerMembersByPriority = (members: ServerMember[], profiles: Record<string, any>): ServerMember[] => {
    return members.sort((a, b) => {
        const profileA = profiles[a.userId]
        const profileB = profiles[b.userId]

        const hasNameA = !!(a.nickname || profileA?.primaryName)
        const hasNameB = !!(b.nickname || profileB?.primaryName)

        const defaultPfpHash = "4mDPmblDGphIFa3r4tfE_o26m0PtfLftlzqscnx-ASo"
        const hasCustomPfpA = !!(profileA?.pfp && profileA.pfp !== defaultPfpHash)
        const hasCustomPfpB = !!(profileB?.pfp && profileB.pfp !== defaultPfpHash)

        // Calculate priority scores (higher is better)
        const scoreA = (hasNameA ? 2 : 0) + (hasCustomPfpA ? 2 : 0)
        const scoreB = (hasNameB ? 2 : 0) + (hasCustomPfpB ? 2 : 0)

        // Sort by priority score first
        if (scoreA !== scoreB) {
            return scoreB - scoreA // Higher scores first
        }

        // If same priority, sort alphabetically by display name
        const displayNameA = getDisplayName(a, profiles)
        const displayNameB = getDisplayName(b, profiles)

        return displayNameA.toLowerCase().localeCompare(displayNameB.toLowerCase())
    })
}

const sortMembersByPriority = (members: Member[], profiles: Record<string, any>): Member[] => {
    return members.sort((a, b) => {
        const profileA = profiles[a.userId]
        const profileB = profiles[b.userId]

        const hasNameA = !!(a.nickname || profileA?.primaryName)
        const hasNameB = !!(b.nickname || profileB?.primaryName)

        const defaultPfpHash = "4mDPmblDGphIFa3r4tfE_o26m0PtfLftlzqscnx-ASo"
        const hasCustomPfpA = !!(profileA?.pfp && profileA.pfp !== defaultPfpHash)
        const hasCustomPfpB = !!(profileB?.pfp && profileB.pfp !== defaultPfpHash)

        // Calculate priority scores (higher is better)
        const scoreA = (hasNameA ? 2 : 0) + (hasCustomPfpA ? 2 : 0)
        const scoreB = (hasNameB ? 2 : 0) + (hasCustomPfpB ? 2 : 0)

        // Sort by priority score first
        if (scoreA !== scoreB) {
            return scoreB - scoreA // Higher scores first
        }

        // If same priority, sort alphabetically by display name
        const displayNameA = getDisplayName(a, profiles)
        const displayNameB = getDisplayName(b, profiles)

        return displayNameA.toLowerCase().localeCompare(displayNameB.toLowerCase())
    })
}

export default function ServerSettings({
    server,
    isServerOwner,
    onCreateCategory,
    onCreateChannel
}: ServerSettingsProps) {
    const subspace = useSubspace()
    const { address } = useWallet()
    const { actions } = useServer()
    const { profiles } = useProfile()

    // Main settings dialog state
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("profile")

    // Server profile state
    const [serverName, setServerName] = useState("")
    const [serverIcon, setServerIcon] = useState<File | null>(null)
    const [isEditingServer, setIsEditingServer] = useState(false)

    // Delete server confirmation state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Update server code confirmation state
    const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    // Server version state
    const [serverVersion, setServerVersion] = useState<string | null>(null)
    const [loadingVersion, setLoadingVersion] = useState(false)

    // Roles state
    const [roles, setRoles] = useState<Role[]>([])
    const [loadingRoles, setLoadingRoles] = useState(false)
    const [createRoleOpen, setCreateRoleOpen] = useState(false)
    const [editRoleOpen, setEditRoleOpen] = useState(false)
    const [deleteRoleOpen, setDeleteRoleOpen] = useState(false)
    const [selectedRole, setSelectedRole] = useState<Role | null>(null)
    const [updatingRoles, setUpdatingRoles] = useState<number[]>([])
    const [showMobileRoleDetails, setShowMobileRoleDetails] = useState(false)

    // Role members state
    const [roleMembers, setRoleMembers] = useState<Member[]>([])
    const [loadingRoleMembers, setLoadingRoleMembers] = useState(false)

    // Add member to role state
    const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
    const [allServerMembers, setAllServerMembers] = useState<ServerMember[]>([])
    const [loadingServerMembers, setLoadingServerMembers] = useState(false)
    const [assigningRole, setAssigningRole] = useState(false)

    // Role form state
    const [roleName, setRoleName] = useState("")
    const [roleColor, setRoleColor] = useState("#696969")
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([])
    const [isCreatingRole, setIsCreatingRole] = useState(false)
    const [isEditingRole, setIsEditingRole] = useState(false)
    const [isDeletingRole, setIsDeletingRole] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Load version when update-code tab is opened
    useEffect(() => {
        if (settingsOpen && activeTab === "update-code" && server?.serverId && !serverVersion) {
            loadServerVersion()
        }
    }, [settingsOpen, activeTab, server?.serverId])

    // Load roles when tab is opened
    useEffect(() => {
        if (settingsOpen && activeTab === "roles" && server?.serverId) {
            loadRoles()
        }
    }, [settingsOpen, activeTab, server?.serverId])

    // Load role members when selected role changes or when Members tab is opened
    useEffect(() => {
        if (selectedRole && server?.serverId && (showMobileRoleDetails || activeTab === "roles")) {
            loadRoleMembers()
        }
    }, [selectedRole, server?.serverId, showMobileRoleDetails, activeTab])

    // Update form when selected role changes
    useEffect(() => {
        if (selectedRole) {
            setRoleName(selectedRole.name)
            setRoleColor(selectedRole.color)
            setRolePermissions(getPermissions(selectedRole.permissions))
            setHasUnsavedChanges(false)
        }
    }, [selectedRole])

    // Check for unsaved changes
    useEffect(() => {
        if (selectedRole) {
            const nameChanged = roleName !== selectedRole.name
            const colorChanged = roleColor !== selectedRole.color
            const permissionsChanged = JSON.stringify(rolePermissions.sort()) !== JSON.stringify(getPermissions(selectedRole.permissions).sort())
            setHasUnsavedChanges(nameChanged || colorChanged || permissionsChanged)
        }
    }, [roleName, roleColor, rolePermissions, selectedRole])

    // Reset mobile view when tab changes or dialog closes
    useEffect(() => {
        if (!settingsOpen || activeTab !== "roles") {
            setShowMobileRoleDetails(false)
            setSelectedRole(null)
        }
    }, [settingsOpen, activeTab])

    // Reset role members when role changes
    useEffect(() => {
        if (selectedRole) {
            setRoleMembers([])
        }
    }, [selectedRole])

    const loadServerVersion = async () => {
        if (!server?.serverId) return

        setLoadingVersion(true)
        try {
            const version = await subspace.server.getVersion({ serverId: server.serverId })
            setServerVersion(version)
        } catch (error) {
            console.error("Error loading server version:", error)
            toast.error("Failed to load server version")
        } finally {
            setLoadingVersion(false)
        }
    }

    const loadRoles = async () => {
        if (!server?.serverId) return

        setLoadingRoles(true)
        try {
            const serverRoles = await subspace.server.role.getRoles({ serverId: server.serverId })
            if (serverRoles) {
                setRoles(serverRoles)
            }
        } catch (error) {
            console.error("Error loading roles:", error)
            toast.error("Failed to load roles")
        } finally {
            setLoadingRoles(false)
        }
    }

    const loadRoleMembers = async () => {
        if (!server?.serverId || !selectedRole) return

        setLoadingRoleMembers(true)
        try {
            const members = await subspace.server.role.getRoleMembers({
                serverId: server.serverId,
                roleId: selectedRole.roleId
            })
            if (members) {
                setRoleMembers(members)
            } else {
                setRoleMembers([])
            }
        } catch (error) {
            console.error("Error loading role members:", error)
            toast.error("Failed to load role members")
            setRoleMembers([])
        } finally {
            setLoadingRoleMembers(false)
        }
    }

    const loadServerMembers = async () => {
        if (!server?.serverId) return

        setLoadingServerMembers(true)
        try {
            const members = await subspace.server.getServerMembers({ serverId: server.serverId })
            if (members) {
                // Ensure we have proper ServerMember type before sorting
                const serverMembers = members as ServerMember[]
                const sortedMembers = sortServerMembersByPriority(serverMembers, profiles)
                setAllServerMembers(sortedMembers as ServerMember[])
            } else {
                setAllServerMembers([])
            }
        } catch (error) {
            console.error("Error loading server members:", error)
            toast.error("Failed to load server members")
            setAllServerMembers([])
        } finally {
            setLoadingServerMembers(false)
        }
    }

    const handleCreateRole = async () => {
        if (!server?.serverId || !roleName.trim()) {
            toast.error("Please enter a role name")
            return
        }

        setIsCreatingRole(true)
        try {
            const permissionSum = rolePermissions.reduce((sum, perm) => sum | perm, 0)
            const success = await subspace.server.role.createRole({
                serverId: server.serverId,
                name: roleName.trim(),
                color: roleColor,
                permissions: permissionSum
            })

            if (success) {
                toast.success("Role created successfully")
                setRoleName("")
                setRoleColor("#696969")
                setRolePermissions([])
                setCreateRoleOpen(false)
                await loadRoles()
            } else {
                toast.error("Failed to create role")
            }
        } catch (error) {
            console.error("Error creating role:", error)
            toast.error("Failed to create role")
        } finally {
            setIsCreatingRole(false)
        }
    }

    const handleSaveRole = async () => {
        if (!server?.serverId || !selectedRole || !roleName.trim()) {
            toast.error("Please enter a role name")
            return
        }

        setIsEditingRole(true)
        try {
            const permissionSum = rolePermissions.reduce((sum, perm) => sum | perm, 0)
            const success = await subspace.server.role.updateRole({
                serverId: server.serverId,
                roleId: selectedRole.roleId,
                name: roleName.trim(),
                color: roleColor,
                permissions: permissionSum
            })

            if (success) {
                toast.success("Role updated successfully")
                setHasUnsavedChanges(false)
                await loadRoles()
                // Update selected role with new data
                const updatedRole = { ...selectedRole, name: roleName.trim(), color: roleColor, permissions: permissionSum }
                setSelectedRole(updatedRole)
            } else {
                toast.error("Failed to update role")
            }
        } catch (error) {
            console.error("Error updating role:", error)
            toast.error("Failed to update role")
        } finally {
            setIsEditingRole(false)
        }
    }

    const handleEditRole = async () => {
        // This function is kept for compatibility but now just calls handleSaveRole
        await handleSaveRole()
    }

    const handleDeleteRole = async () => {
        if (!server?.serverId || !selectedRole) {
            toast.error("No role selected")
            return
        }

        setIsDeletingRole(true)
        try {
            const usersUpdated = await subspace.server.role.deleteRole({
                serverId: server.serverId,
                roleId: selectedRole.roleId
            })

            if (usersUpdated !== null) {
                toast.success(`Role deleted successfully. ${usersUpdated} users were updated.`)
                setDeleteRoleOpen(false)
                setSelectedRole(null)
                await loadRoles()
            } else {
                toast.error("Failed to delete role")
            }
        } catch (error) {
            console.error("Error deleting role:", error)
            toast.error("Failed to delete role")
        } finally {
            setIsDeletingRole(false)
        }
    }

    const openCreateRole = () => {
        setRoleName("")
        setRoleColor("#696969")
        setRolePermissions([])
        setCreateRoleOpen(true)
    }

    const openEditRole = (role: Role) => {
        setSelectedRole(role)
        setRoleName(role.name)
        setRoleColor(role.color)
        setRolePermissions(getPermissions(role.permissions))
        setEditRoleOpen(true)
    }

    const openDeleteRole = (role: Role) => {
        setSelectedRole(role)
        setDeleteRoleOpen(true)
    }

    const togglePermission = (permission: Permission) => {
        setRolePermissions(prev => {
            if (prev.includes(permission)) {
                return prev.filter(p => p !== permission)
            } else {
                return [...prev, permission]
            }
        })
    }

    const handleCopyInvite = () => {
        if (!server) return
        const inviteLink = `${window.location.origin}/#/invite/${server.serverId}`
        navigator.clipboard.writeText(inviteLink)
        toast.success("Invite link copied to clipboard")
    }

    const handleUpdateServerCode = async () => {
        if (!server?.serverId) {
            toast.error("No server ID found")
            return
        }

        setIsUpdating(true)

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
                setUpdateConfirmOpen(false)
            } else {
                toast.error("Failed to update server code", { richColors: true })
            }
        } catch (error) {
            console.error("Error updating server code:", error)
            toast.dismiss()
            toast.error(error instanceof Error ? error.message : "Failed to update server code")
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDeleteServer = async () => {
        if (!server?.serverId || !address) {
            toast.error("Unable to delete server")
            return
        }

        setIsDeleting(true)

        try {
            const success = await subspace.user.leaveServer({ serverId: server.serverId })

            if (success) {
                // Update local state
                const { serversJoined } = useServer.getState()
                const currentServers = Array.isArray(serversJoined[address]) ? serversJoined[address] : []
                const updatedServers = currentServers.filter(id => id !== server.serverId)
                actions.setServersJoined(address, updatedServers)
                actions.removeServer(server.serverId)

                // Reset active server
                actions.setActiveServerId("")
                actions.setActiveChannelId(0)

                toast.success("Server deleted successfully")
                setDeleteConfirmOpen(false)
                setSettingsOpen(false)
            } else {
                toast.error("Failed to delete server")
            }
        } catch (error) {
            console.error("Error deleting server:", error)
            toast.error("Failed to delete server")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleEditServer = async () => {
        if (!server?.serverId || !serverName.trim()) {
            toast.error("Please enter a server name")
            return
        }

        setIsEditingServer(true)
        try {
            let iconId = server?.icon || ""

            // Upload new icon if provided
            if (serverIcon) {
                toast.loading("Uploading server icon...", {
                    richColors: true,
                    style: { backgroundColor: "var(--background)", color: "var(--foreground)" }
                })

                try {
                    const uploadedIconId = await uploadFileAR(serverIcon)
                    if (uploadedIconId) {
                        iconId = uploadedIconId
                        toast.dismiss()
                    } else {
                        toast.dismiss()
                        toast.error("Failed to upload server icon")
                        return
                    }
                } catch (error) {
                    console.error("Error uploading icon:", error)
                    toast.dismiss()
                    toast.error("Failed to upload server icon")
                    return
                }
            }

            toast.loading("Updating server details...", {
                richColors: true,
                style: { backgroundColor: "var(--background)", color: "var(--foreground)" }
            })

            const success = await subspace.server.updateServer({
                serverId: server.serverId,
                name: serverName.trim(),
                icon: iconId
            })

            toast.dismiss()

            if (success) {
                toast.success("Server details updated successfully", {
                    richColors: true,
                    style: { backgroundColor: "var(--background)", color: "var(--foreground)" }
                })

                // Refresh server data
                const updatedServer = await subspace.server.getServerDetails({ serverId: server.serverId })
                if (updatedServer) {
                    actions.updateServer(server.serverId, updatedServer as Server)
                }

                setServerName("")
                setServerIcon(null)
            } else {
                toast.error("Failed to update server details")
            }
        } catch (error) {
            console.error("Error updating server:", error)
            toast.error("Failed to update server details")
        } finally {
            setIsEditingServer(false)
        }
    }

    // Initialize server name when settings open
    useEffect(() => {
        if (settingsOpen && server) {
            setServerName(server.name)
            setServerIcon(null)
        }
    }, [settingsOpen, server])

    // Clear version when settings close to ensure fresh data on next open
    useEffect(() => {
        if (!settingsOpen) {
            setServerVersion(null)
        }
    }, [settingsOpen])

    const handleRoleDragEnd = async (result: any) => {
        const { source, destination } = result

        // Dropped outside the list
        if (!destination) return

        // No change
        if (source.index === destination.index) return

        if (!server?.serverId) return

        // Reorder roles array
        const newRoles = Array.from(roles)
        const [removed] = newRoles.splice(source.index, 1)
        newRoles.splice(destination.index, 0, removed)

        // Update local state immediately (optimistic update)
        const updatedRoles = newRoles.map((role, index) => ({
            ...role,
            orderId: index + 1
        }))
        setRoles(updatedRoles)

        // Update the order_id of the moved role
        const roleToUpdate = newRoles[destination.index]
        const newOrder = destination.index + 1

        // Mark this role as updating
        setUpdatingRoles(prev => [...prev, roleToUpdate.roleId])

        try {
            const success = await subspace.server.role.updateRole({
                serverId: server.serverId,
                roleId: roleToUpdate.roleId,
                orderId: newOrder
            })

            if (success) {
                toast.success('Role order updated')
                // Refresh roles to get the correct order from server
                await loadRoles()
            } else {
                throw new Error('Failed to update role order')
            }
        } catch (error) {
            console.error('Error updating role order:', error)
            toast.error('Failed to update role order')

            // Revert optimistic update
            await loadRoles()
        } finally {
            setUpdatingRoles(prev => prev.filter(id => id !== roleToUpdate.roleId))
        }
    }

    const handleMobileRoleSelect = (role: Role) => {
        setSelectedRole(role)
        setShowMobileRoleDetails(true)
    }

    const handleMobileBackToList = () => {
        setShowMobileRoleDetails(false)
        setSelectedRole(null)
    }

    const handleAssignRole = async (userId: string) => {
        if (!server?.serverId || !selectedRole) {
            toast.error("No role selected")
            return
        }

        setAssigningRole(true)
        try {
            const success = await subspace.server.role.assignRole({
                serverId: server.serverId,
                userId: userId,
                roleId: selectedRole.roleId
            })

            if (success) {
                toast.success("Role assigned successfully")
                setAddMemberDialogOpen(false)
                // Refresh role members list
                await loadRoleMembers()
                // Refresh server members list to update available members
                await loadServerMembers()
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

    const handleRemoveRole = async (userId: string) => {
        if (!server?.serverId || !selectedRole) {
            toast.error("No role selected")
            return
        }

        try {
            const success = await subspace.server.role.unassignRole({
                serverId: server.serverId,
                userId: userId,
                roleId: selectedRole.roleId
            })

            if (success) {
                toast.success("Role removed successfully")
                // Refresh role members list
                await loadRoleMembers()
                // Refresh server members list to update available members
                await loadServerMembers()
            } else {
                toast.error("Failed to remove role")
            }
        } catch (error) {
            console.error("Error removing role:", error)
            toast.error("Failed to remove role")
        }
    }

    // Load server members when add member dialog opens
    useEffect(() => {
        if (addMemberDialogOpen && server?.serverId) {
            loadServerMembers()
        }
    }, [addMemberDialogOpen, server?.serverId])

    // In the Members Tab section, update the role members display
    const renderRoleMembersSection = () => {
        if (loadingRoleMembers) {
            return (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Loading members...</span>
                </div>
            )
        }

        if (roleMembers.length === 0) {
            return (
                <div className="text-center py-8">
                    <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground mb-1">No members with this role</p>
                    <p className="text-sm text-muted-foreground/60">Members with this role will appear here</p>
                </div>
            )
        }

        // Sort role members by priority
        const sortedRoleMembers = sortMembersByPriority(roleMembers, profiles)

        return (
            <div className="space-y-2">
                {sortedRoleMembers.map((member) => {
                    const displayName = getDisplayName(member, profiles)
                    const profile = profiles[member.userId]

                    return (
                        <div
                            key={member.userId}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:border-border/50 hover:bg-muted/30 transition-colors group"
                        >
                            <MemberAvatar userId={member.userId} size="sm" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                    {displayName}
                                </div>
                                {(member.nickname || profile?.primaryName) && member.userId !== displayName && (
                                    <div className="text-xs text-muted-foreground truncate">
                                        {member.userId}
                                    </div>
                                )}
                            </div>
                            {isServerOwner && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleRemoveRole(member.userId)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    // Get available members (those who don't already have the selected role)
    const getAvailableMembers = () => {
        if (!selectedRole) return []

        const availableMembers = allServerMembers.filter(member => {
            try {
                return !member.roles.includes(selectedRole.roleId)
            } catch (error) {
                // If parsing fails, assume no roles and include the member
                console.warn("Failed to parse member roles:", error)
                return true
            }
        })

        // Sort available members by priority
        return sortServerMembersByPriority(availableMembers, profiles)
    }

    return (
        <>
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

                    {/* Create Category - Only for owner */}
                    {isServerOwner && (
                        <DropdownMenuItem
                            onClick={onCreateCategory}
                            className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md transition-colors"
                        >
                            <Plus className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Create Category</p>
                                <p className="text-xs text-muted-foreground">Add a new category</p>
                            </div>
                        </DropdownMenuItem>
                    )}

                    {/* Create Channel - Only for owner */}
                    {isServerOwner && (
                        <DropdownMenuItem
                            onClick={() => onCreateChannel()}
                            className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md transition-colors"
                        >
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Create Channel</p>
                                <p className="text-xs text-muted-foreground">Add a new channel</p>
                            </div>
                        </DropdownMenuItem>
                    )}

                    {/* Separator */}
                    <DropdownMenuSeparator className="my-2" />

                    {/* Server Settings - Only for owner */}
                    {isServerOwner && (
                        <DropdownMenuItem
                            onClick={() => setSettingsOpen(true)}
                            className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md transition-colors"
                        >
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Server Settings</p>
                                <p className="text-xs text-muted-foreground">Configure server options</p>
                            </div>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Full-screen Server Settings Dialog */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="!w-screen h-screen min-w-screen max-w-screen max-h-none p-0 gap-0 overflow-hidden rounded-none border-0 flex flex-col items-start justify-start">
                    <DialogHeader className="p-4 h-fit w-full border-b border-border/50 flex-shrink-0 bg-background/95 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="flex items-center gap-4 text-2xl">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Settings className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <div className="font-bold">Server Settings</div>
                                    <div className="text-base font-normal text-muted-foreground mt-1">
                                        Configure {server.name}
                                    </div>
                                </div>
                            </DialogTitle>
                        </div>
                    </DialogHeader>

                    <div className="w-full h-full overflow-hidden bg-background">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-0 md:flex-row w-full h-full">
                            {/* Tab Navigation */}
                            <div className="w-full md:w-80 flex-shrink-0 bg-muted/20 border-r border-border/50">
                                <div className="p-4 py-2">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                                        Configuration
                                    </h3>

                                    {/* Mobile Dropdown - only visible on mobile */}
                                    <div className="md:hidden mb-4">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between h-14 px-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                            {activeTab === "profile" && <User className="w-4 h-4 text-primary" />}
                                                            {activeTab === "roles" && <Shield className="w-4 h-4 text-primary" />}
                                                            {activeTab === "update-code" && <Upload className="w-4 h-4 text-primary" />}
                                                            {activeTab === "delete" && <Trash2 className="w-4 h-4 text-destructive" />}
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-medium">
                                                                {activeTab === "profile" && "Server Profile"}
                                                                {activeTab === "roles" && "Roles"}
                                                                {activeTab === "update-code" && "Update Server Code"}
                                                                {activeTab === "delete" && "Delete Server"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {activeTab === "profile" && "Name and icon"}
                                                                {activeTab === "roles" && "Permissions"}
                                                                {activeTab === "update-code" && "Latest version"}
                                                                {activeTab === "delete" && "Permanent action"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronDown className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-[90vw] mx-auto" align="start">
                                                <DropdownMenuItem
                                                    onClick={() => setActiveTab("profile")}
                                                    className={cn(
                                                        "cursor-pointer flex items-center gap-4 h-14 px-4 rounded-md transition-all",
                                                        activeTab === "profile" && "bg-accent"
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                        <User className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-medium">Server Profile</div>
                                                        <div className="text-xs text-muted-foreground">Name and icon</div>
                                                    </div>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setActiveTab("roles")}
                                                    className={cn(
                                                        "cursor-pointer flex items-center gap-4 h-14 px-4 rounded-md transition-all",
                                                        activeTab === "roles" && "bg-accent"
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                        <Shield className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-medium">Roles</div>
                                                        <div className="text-xs text-muted-foreground">Permissions</div>
                                                    </div>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setActiveTab("update-code")}
                                                    className={cn(
                                                        "cursor-pointer flex items-center gap-4 h-14 px-4 rounded-md transition-all",
                                                        activeTab === "update-code" && "bg-accent"
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                        <Upload className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-medium">Update Server Code</div>
                                                        <div className="text-xs text-muted-foreground">Latest version</div>
                                                    </div>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setActiveTab("delete")}
                                                    className={cn(
                                                        "cursor-pointer flex items-center gap-4 h-14 px-4 rounded-md transition-all text-destructive",
                                                        activeTab === "delete" && "bg-accent"
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-medium">Delete Server</div>
                                                        <div className="text-xs text-muted-foreground">Permanent action</div>
                                                    </div>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {/* Desktop Tab List - hidden on mobile */}
                                    <TabsList className="hidden md:flex flex-col w-full justify-start bg-transparent p-0 space-y-2 h-auto">
                                        <TabsTrigger
                                            value="profile"
                                            className="w-full justify-start gap-4 h-14 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <User className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">Server Profile</div>
                                                <div className="text-xs text-muted-foreground">Name and icon</div>
                                            </div>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="roles"
                                            className="w-full justify-start gap-4 h-14 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Shield className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">Roles</div>
                                                <div className="text-xs text-muted-foreground">Permissions</div>
                                            </div>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="update-code"
                                            className="w-full justify-start gap-4 h-14 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Upload className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">Update Server Code</div>
                                                <div className="text-xs text-muted-foreground">Latest version</div>
                                            </div>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="delete"
                                            className="w-full justify-start gap-4 h-14 px-4 rounded-lg data-[state=active]:bg-background  data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 transition-all text-destructive data-[state=active]:!text-destructive"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">Delete Server</div>
                                                <div className="text-xs text-muted-foreground">Permanent action</div>
                                            </div>
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="flex overflow-y-scroll mb-4 w-full">
                                {/* Server Profile Tab */}
                                <TabsContent value="profile" className="px-4 space-y-8 m-0 h-full max-w-4xl">
                                    <div>
                                        <h3 className="text-2xl font-bold mb-3">Server Profile</h3>
                                        <p className="text-muted-foreground text-lg">
                                            Update your server's name and icon to customize its appearance for all members.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        {/* Server Icon Upload */}
                                        <div className="xl:col-span-1">
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-lg font-semibold mb-2">Server Icon</h4>
                                                    <p className="text-sm text-muted-foreground mb-4">
                                                        Upload a custom icon for your server. Recommended size: 512x512px.
                                                    </p>
                                                </div>
                                                <FileDropzone
                                                    onFileChange={setServerIcon}
                                                    label=""
                                                    currentFile={server?.icon}
                                                    placeholder="Upload new icon"
                                                    accept={{ 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] }}
                                                    previewType="square"
                                                    maxSize={100 * 1024} // 100KB
                                                />
                                            </div>
                                        </div>

                                        {/* Server Details */}
                                        <div className="xl:col-span-2 space-y-6">
                                            <div>
                                                <h4 className="text-lg font-semibold mb-4">Server Information</h4>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-foreground">
                                                            Server Name *
                                                        </label>
                                                        <Input
                                                            type="text"
                                                            placeholder="My Awesome Server"
                                                            value={serverName}
                                                            onChange={(e) => setServerName(e.target.value)}
                                                            disabled={isEditingServer}
                                                            className="h-12 text-base"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-primary/5 rounded-xl border border-primary/10">
                                                <h4 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                                    Changes will:
                                                </h4>
                                                <ul className="text-sm text-muted-foreground space-y-2">
                                                    <li className="flex items-start gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                                        <span>Update the server name for all members instantly</span>
                                                    </li>
                                                    <li className="flex items-start gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                                        <span>Replace the server icon if a new one is uploaded</span>
                                                    </li>
                                                    <li className="flex items-start gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                                        <span>Apply changes immediately across the network</span>
                                                    </li>
                                                </ul>
                                            </div>

                                            <Button
                                                onClick={handleEditServer}
                                                disabled={!serverName.trim() || isEditingServer}
                                                className="h-12 px-8 text-base"
                                                size="lg"
                                            >
                                                {isEditingServer ? (
                                                    <div className="flex items-center gap-3">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>Updating Server...</span>
                                                    </div>
                                                ) : (
                                                    "Update Server Profile"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Roles Tab */}
                                <TabsContent value="roles" className="p-0 space-y-0 m-0 h-full max-w-none">
                                    <div className="h-full flex flex-col">
                                        <div className="p-4 md:p-8 pb-4">
                                            <h3 className="text-xl md:text-2xl font-bold mb-3">Roles & Permissions</h3>
                                            <p className="text-muted-foreground text-base md:text-lg">
                                                Manage server roles and configure permissions for different user groups.
                                            </p>
                                        </div>

                                        <div className="flex-1 flex flex-col md:flex-row ">
                                            {/* Mobile View - Conditional rendering */}
                                            <div className="md:hidden flex-1 flex flex-col">
                                                {!showMobileRoleDetails ? (
                                                    /* Mobile Roles List */
                                                    <div className="flex flex-col h-full">
                                                        <div className="p-4 border-b border-border/50">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="font-semibold">Roles</h4>
                                                                <Button onClick={openCreateRole} size="sm" className="h-8">
                                                                    <Plus className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">
                                                                Use roles to group your server members and assign permissions.
                                                            </p>
                                                        </div>

                                                        <div className="flex-1 overflow-y-auto p-2">
                                                            {loadingRoles ? (
                                                                <div className="flex items-center justify-center py-8">
                                                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                                    <span className="ml-2 text-muted-foreground text-sm">Loading...</span>
                                                                </div>
                                                            ) : roles.length === 0 ? (
                                                                <div className="text-center py-8">
                                                                    <Shield className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                                                                    <p className="text-sm text-muted-foreground mb-3">No roles yet</p>
                                                                    <Button onClick={openCreateRole} variant="outline" size="sm">
                                                                        <Plus className="w-4 h-4 mr-2" />
                                                                        Create Role
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <DragDropContext onDragEnd={handleRoleDragEnd}>
                                                                    <Droppable droppableId="roles">
                                                                        {(provided, snapshot) => (
                                                                            <div
                                                                                ref={provided.innerRef}
                                                                                {...provided.droppableProps}
                                                                                className={cn(
                                                                                    "space-y-1",
                                                                                    snapshot.isDraggingOver && "bg-accent/20 p-2 rounded-lg"
                                                                                )}
                                                                            >
                                                                                {roles.map((role, index) => (
                                                                                    <Draggable
                                                                                        key={role.roleId}
                                                                                        draggableId={`role-${role.roleId}`}
                                                                                        index={index}
                                                                                        isDragDisabled={updatingRoles.includes(role.roleId)}
                                                                                    >
                                                                                        {(provided, snapshot) => (
                                                                                            <div
                                                                                                ref={provided.innerRef}
                                                                                                {...provided.draggableProps}
                                                                                                className={cn(
                                                                                                    "p-3 rounded-lg border border-transparent hover:border-border/50 hover:bg-background/50 transition-all duration-200 cursor-pointer group",
                                                                                                    snapshot.isDragging && "opacity-50 shadow-lg ring-1 ring-primary/30"
                                                                                                )}
                                                                                                onClick={() => handleMobileRoleSelect(role)}
                                                                                            >
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div
                                                                                                        {...provided.dragHandleProps}
                                                                                                        className="opacity-20 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                                                                                                    >
                                                                                                        <GripVertical className="w-4 h-4" />
                                                                                                    </div>
                                                                                                    <div
                                                                                                        className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0"
                                                                                                        style={{ backgroundColor: role.color }}
                                                                                                    />
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="font-medium text-sm truncate">{role.name}</div>
                                                                                                        <div className="text-xs text-muted-foreground">
                                                                                                            {getPermissions(role.permissions).length} permission{getPermissions(role.permissions).length !== 1 ? 's' : ''}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    {updatingRoles.includes(role.roleId) && (
                                                                                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </Draggable>
                                                                                ))}
                                                                                {provided.placeholder}
                                                                            </div>
                                                                        )}
                                                                    </Droppable>
                                                                </DragDropContext>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Mobile Role Details */
                                                    selectedRole && (
                                                        <Tabs defaultValue="display" className="flex flex-col h-full">
                                                            {/* Mobile Header with Back Button */}
                                                            <div className="border-b border-border/50 bg-background/50">
                                                                <div className="flex items-center gap-3 px-4 py-3">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={handleMobileBackToList}
                                                                        className="h-8 w-8 p-0"
                                                                    >
                                                                        <ChevronDown className="w-4 h-4 rotate-90" />
                                                                    </Button>
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        <div
                                                                            className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0"
                                                                            style={{ backgroundColor: selectedRole.color }}
                                                                        />
                                                                        <h4 className="font-semibold truncate">{selectedRole.name}</h4>
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => openDeleteRole(selectedRole)}
                                                                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>

                                                                <div className="px-4 pb-3">
                                                                    <TabsList className="bg-muted/30 p-1 w-full">
                                                                        <TabsTrigger value="display" className="px-4 py-2 flex-1">Display</TabsTrigger>
                                                                        <TabsTrigger value="permissions" className="px-4 py-2 flex-1">Permissions</TabsTrigger>
                                                                    </TabsList>
                                                                    {hasUnsavedChanges && (
                                                                        <Button
                                                                            onClick={handleSaveRole}
                                                                            disabled={isEditingRole || !roleName.trim()}
                                                                            className="w-full mt-3"
                                                                            size="sm"
                                                                        >
                                                                            {isEditingRole ? (
                                                                                <>
                                                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                                                    Saving...
                                                                                </>
                                                                            ) : (
                                                                                "Save Changes"
                                                                            )}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Mobile Tab Content */}
                                                            <div className="flex-1 overflow-hidden">
                                                                {/* Display Tab */}
                                                                <TabsContent value="display" className="m-0 h-full overflow-y-auto">
                                                                    <div className="p-4 space-y-6">
                                                                        <div className="space-y-6">
                                                                            {/* Role Name */}
                                                                            <div className="space-y-3">
                                                                                <label className="text-sm font-medium text-foreground">
                                                                                    Role Name <span className="text-destructive">*</span>
                                                                                </label>
                                                                                <Input
                                                                                    value={roleName}
                                                                                    onChange={(e) => setRoleName(e.target.value)}
                                                                                    className="w-full"
                                                                                    disabled={isEditingRole}
                                                                                />
                                                                            </div>

                                                                            {/* Role Color */}
                                                                            <div className="space-y-3">
                                                                                <label className="text-sm font-medium text-foreground">
                                                                                    Role Color <span className="text-destructive">*</span>
                                                                                </label>
                                                                                <p className="text-sm text-muted-foreground">
                                                                                    Members use the color of the highest role they have on the roles list.
                                                                                </p>
                                                                                <div className="flex flex-col gap-4">
                                                                                    <div
                                                                                        className="w-16 h-16 rounded-lg border border-border/50 flex-shrink-0 mx-auto"
                                                                                        style={{ backgroundColor: roleColor }}
                                                                                    />
                                                                                    <div className="space-y-3 w-full">
                                                                                        <input
                                                                                            type="color"
                                                                                            value={roleColor}
                                                                                            onChange={(e) => setRoleColor(e.target.value)}
                                                                                            className="sr-only"
                                                                                            id="mobile-role-color-picker"
                                                                                        />
                                                                                        <div className="grid grid-cols-10 gap-2 w-full">
                                                                                            {[
                                                                                                '#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245',
                                                                                                '#ff6600', '#1abc9c', '#9b59b6', '#e67e22', '#95a5a6',
                                                                                                '#34495e', '#11806a', '#206694', '#71368a', '#ad1457',
                                                                                                '#c27c0e', '#a84300', '#992d22', '#979c9f', '#7f8c8d'
                                                                                            ].map((color) => (
                                                                                                <button
                                                                                                    key={color}
                                                                                                    type="button"
                                                                                                    className={cn(
                                                                                                        "w-6 h-6 rounded border-2 transition-all hover:scale-110",
                                                                                                        roleColor === color ? "border-foreground" : "border-border/30"
                                                                                                    )}
                                                                                                    style={{ backgroundColor: color }}
                                                                                                    onClick={() => setRoleColor(color)}
                                                                                                />
                                                                                            ))}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <label htmlFor="mobile-role-color-picker" className="cursor-pointer">
                                                                                                <div className="w-8 h-8 rounded border border-border/50 bg-muted/50 hover:bg-muted flex items-center justify-center">
                                                                                                    <Pencil className="w-4 h-4" />
                                                                                                </div>
                                                                                            </label>
                                                                                            <Input
                                                                                                value={roleColor}
                                                                                                onChange={(e) => setRoleColor(e.target.value)}
                                                                                                className="flex-1 font-mono text-sm"
                                                                                                placeholder="#696969"
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </TabsContent>

                                                                {/* Permissions Tab */}
                                                                <TabsContent value="permissions" className="m-0 h-full overflow-y-auto">
                                                                    <div className="p-4 space-y-6">
                                                                        <div className="flex items-center justify-between">
                                                                            <h4 className="text-lg font-semibold">Permissions</h4>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => setRolePermissions([])}
                                                                                className="text-sm"
                                                                            >
                                                                                Clear all
                                                                            </Button>
                                                                        </div>

                                                                        <div className="space-y-1">
                                                                            {Object.values(Permission).filter(p => typeof p === 'number').map((permission) => (
                                                                                <div
                                                                                    key={permission}
                                                                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                                                                                >
                                                                                    <div className="flex-1 pr-4">
                                                                                        <div className="font-medium text-sm">
                                                                                            {Permission[permission as Permission]}
                                                                                        </div>
                                                                                        <div className="text-xs text-muted-foreground mt-1">
                                                                                            {permission === Permission.SEND_MESSAGES && "Allows members to send messages in text channels."}
                                                                                            {permission === Permission.MANAGE_CHANNELS && "Allows members to create, edit, or delete channels."}
                                                                                            {permission === Permission.MANAGE_ROLES && "Allows members to create new roles and edit or delete roles lower than their highest role."}
                                                                                            {permission === Permission.MANAGE_SERVER && "Allows members to change the server's name and other settings."}
                                                                                            {permission === Permission.DELETE_MESSAGES && "Allows members to delete messages from other users."}
                                                                                            {permission === Permission.KICK_MEMBERS && "Allows members to remove other members from this server."}
                                                                                            {permission === Permission.BAN_MEMBERS && "Allows members to permanently ban other members from this server."}
                                                                                            {permission === Permission.ADMINISTRATOR && "Members with this permission will have every permission and also bypass all channel specific permissions."}
                                                                                            {permission === Permission.MANAGE_NICKNAMES && "Allows members to change nicknames of other members."}
                                                                                            {permission === Permission.MANAGE_MEMBERS && "Allows members to manage other members' roles and permissions."}
                                                                                            {permission === Permission.MENTION_EVERYONE && "Allows members to use @everyone and @here mentions."}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex-shrink-0">
                                                                                        <button
                                                                                            type="button"
                                                                                            role="switch"
                                                                                            aria-checked={rolePermissions.includes(permission as Permission)}
                                                                                            onClick={() => togglePermission(permission as Permission)}
                                                                                            className={cn(
                                                                                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                                                                                rolePermissions.includes(permission as Permission)
                                                                                                    ? "bg-primary"
                                                                                                    : "bg-input"
                                                                                            )}
                                                                                        >
                                                                                            <span
                                                                                                className={cn(
                                                                                                    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                                                                                                    rolePermissions.includes(permission as Permission) ? "translate-x-6" : "translate-x-1"
                                                                                                )}
                                                                                            />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </TabsContent>
                                                            </div>
                                                        </Tabs>
                                                    )
                                                )}
                                            </div>

                                            {/* Desktop View - Side by side layout (hidden on mobile) */}
                                            <div className="hidden md:flex flex-1 overflow-hidden">
                                                {/* Left Sidebar - Roles List */}
                                                <div className="w-80 border-r border-border/50 bg-muted/20 flex flex-col">
                                                    <div className="p-4 border-b border-border/50">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="font-semibold">Roles</h4>
                                                            <Button onClick={openCreateRole} size="sm" className="h-8">
                                                                <Plus className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Use roles to group your server members and assign permissions.
                                                        </p>
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto p-2">
                                                        {loadingRoles ? (
                                                            <div className="flex items-center justify-center py-8">
                                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                                <span className="ml-2 text-muted-foreground text-sm">Loading...</span>
                                                            </div>
                                                        ) : roles.length === 0 ? (
                                                            <div className="text-center py-8">
                                                                <Shield className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                                                                <p className="text-sm text-muted-foreground mb-3">No roles yet</p>
                                                                <Button onClick={openCreateRole} variant="outline" size="sm">
                                                                    <Plus className="w-4 h-4 mr-2" />
                                                                    Create Role
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <DragDropContext onDragEnd={handleRoleDragEnd}>
                                                                <Droppable droppableId="roles">
                                                                    {(provided, snapshot) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.droppableProps}
                                                                            className={cn(
                                                                                "space-y-1",
                                                                                snapshot.isDraggingOver && "bg-accent/20 p-2 rounded-lg"
                                                                            )}
                                                                        >
                                                                            {roles.map((role, index) => (
                                                                                <Draggable
                                                                                    key={role.roleId}
                                                                                    draggableId={`role-${role.roleId}`}
                                                                                    index={index}
                                                                                    isDragDisabled={updatingRoles.includes(role.roleId)}
                                                                                >
                                                                                    {(provided, snapshot) => (
                                                                                        <div
                                                                                            ref={provided.innerRef}
                                                                                            {...provided.draggableProps}
                                                                                            className={cn(
                                                                                                "p-3 rounded-lg border border-transparent hover:border-border/50 hover:bg-background/50 transition-all duration-200 cursor-pointer group",
                                                                                                selectedRole?.roleId === role.roleId && "bg-background border-border/50 shadow-sm",
                                                                                                snapshot.isDragging && "opacity-90 shadow-lg ring-1 ring-primary/30"
                                                                                            )}
                                                                                            onClick={() => setSelectedRole(role)}
                                                                                        >
                                                                                            <div className="flex items-center gap-3">
                                                                                                <div
                                                                                                    {...provided.dragHandleProps}
                                                                                                    className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                                                                                                >
                                                                                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                                                                                </div>
                                                                                                <div
                                                                                                    className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0"
                                                                                                    style={{ backgroundColor: role.color }}
                                                                                                />
                                                                                                <div className="flex-1 min-w-0">
                                                                                                    <div className="font-medium text-sm truncate">{role.name}</div>
                                                                                                    <div className="text-xs text-muted-foreground">
                                                                                                        {getPermissions(role.permissions).length} permission{getPermissions(role.permissions).length !== 1 ? 's' : ''}
                                                                                                    </div>
                                                                                                </div>
                                                                                                {updatingRoles.includes(role.roleId) && (
                                                                                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </Draggable>
                                                                            ))}
                                                                            {provided.placeholder}
                                                                        </div>
                                                                    )}
                                                                </Droppable>
                                                            </DragDropContext>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right Panel - Role Editor */}
                                                <div className="flex-1 flex flex-col overflow-hidden">
                                                    {selectedRole ? (
                                                        <Tabs defaultValue="display" className="flex flex-col h-full">
                                                            {/* Tab Navigation */}
                                                            <div className="border-b border-border/50 bg-background/50">
                                                                <div className="flex items-center justify-between px-6 py-3">
                                                                    <TabsList className="bg-muted/30 p-1">
                                                                        <TabsTrigger value="display" className="px-4 py-2">Display</TabsTrigger>
                                                                        <TabsTrigger value="permissions" className="px-4 py-2">Permissions</TabsTrigger>
                                                                        <TabsTrigger value="members" className="px-4 py-2">Members</TabsTrigger>
                                                                    </TabsList>
                                                                    <div className="flex items-center gap-2">
                                                                        {hasUnsavedChanges && (
                                                                            <Button
                                                                                onClick={handleSaveRole}
                                                                                disabled={isEditingRole || !roleName.trim()}
                                                                                className="h-8"
                                                                                size="sm"
                                                                            >
                                                                                {isEditingRole ? (
                                                                                    <>
                                                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                                                        Saving...
                                                                                    </>
                                                                                ) : (
                                                                                    "Save Changes"
                                                                                )}
                                                                            </Button>
                                                                        )}
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => openDeleteRole(selectedRole)}
                                                                            className="text-destructive hover:text-destructive"
                                                                        >
                                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                                            Delete Role
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Tab Content */}
                                                            <div className="flex-1 overflow-hidden">
                                                                {/* Display Tab */}
                                                                <TabsContent value="display" className="m-0 h-full overflow-y-auto">
                                                                    <div className="p-6 space-y-6">
                                                                        <div>
                                                                            <h4 className="text-lg font-semibold mb-4">Display</h4>

                                                                            <div className="space-y-6">
                                                                                {/* Role Name */}
                                                                                <div className="space-y-3">
                                                                                    <label className="text-sm font-medium text-foreground">
                                                                                        Role Name <span className="text-destructive">*</span>
                                                                                    </label>
                                                                                    <Input
                                                                                        value={roleName}
                                                                                        onChange={(e) => setRoleName(e.target.value)}
                                                                                        className="max-w-md"
                                                                                        disabled={isEditingRole}
                                                                                    />
                                                                                </div>

                                                                                {/* Role Color */}
                                                                                <div className="space-y-3">
                                                                                    <label className="text-sm font-medium text-foreground">
                                                                                        Role Color <span className="text-destructive">*</span>
                                                                                    </label>
                                                                                    <p className="text-sm text-muted-foreground">
                                                                                        Members use the color of the highest role they have on the roles list.
                                                                                    </p>
                                                                                    <div className="flex items-center gap-4">
                                                                                        <div
                                                                                            className="w-16 h-16 rounded-lg border border-border/50 flex-shrink-0"
                                                                                            style={{ backgroundColor: roleColor }}
                                                                                        />
                                                                                        <div className="space-y-3">
                                                                                            <input
                                                                                                type="color"
                                                                                                value={roleColor}
                                                                                                onChange={(e) => setRoleColor(e.target.value)}
                                                                                                className="sr-only"
                                                                                                id="role-color-picker"
                                                                                            />
                                                                                            <div className="grid grid-cols-10 gap-2 max-w-md">
                                                                                                {[
                                                                                                    '#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245',
                                                                                                    '#ff6600', '#1abc9c', '#9b59b6', '#e67e22', '#95a5a6',
                                                                                                    '#34495e', '#11806a', '#206694', '#71368a', '#ad1457',
                                                                                                    '#c27c0e', '#a84300', '#992d22', '#979c9f', '#7f8c8d'
                                                                                                ].map((color) => (
                                                                                                    <button
                                                                                                        key={color}
                                                                                                        type="button"
                                                                                                        className={cn(
                                                                                                            "w-8 h-8 rounded border-2 transition-all hover:scale-110",
                                                                                                            roleColor === color ? "border-foreground" : "border-border/30"
                                                                                                        )}
                                                                                                        style={{ backgroundColor: color }}
                                                                                                        onClick={() => setRoleColor(color)}
                                                                                                    />
                                                                                                ))}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <label htmlFor="role-color-picker" className="cursor-pointer">
                                                                                                    <div className="w-8 h-8 rounded border border-border/50 bg-muted/50 hover:bg-muted flex items-center justify-center">
                                                                                                        <Pencil className="w-4 h-4" />
                                                                                                    </div>
                                                                                                </label>
                                                                                                <Input
                                                                                                    value={roleColor}
                                                                                                    onChange={(e) => setRoleColor(e.target.value)}
                                                                                                    className="w-24 font-mono text-sm"
                                                                                                    placeholder="#696969"
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </TabsContent>

                                                                {/* Permissions Tab */}
                                                                <TabsContent value="permissions" className="m-0 h-full overflow-y-auto">
                                                                    <div className="p-6 space-y-6">
                                                                        <div className="flex items-center justify-between">
                                                                            <h4 className="text-lg font-semibold">Permissions</h4>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => setRolePermissions([])}
                                                                                className="text-sm"
                                                                            >
                                                                                Clear permissions
                                                                            </Button>
                                                                        </div>

                                                                        <div className="space-y-1">
                                                                            {Object.values(Permission).filter(p => typeof p === 'number').map((permission) => (
                                                                                <div
                                                                                    key={permission}
                                                                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                                                                                >
                                                                                    <div className="flex-1 pr-4">
                                                                                        <div className="font-medium text-sm">
                                                                                            {Permission[permission as Permission]}
                                                                                        </div>
                                                                                        <div className="text-xs text-muted-foreground mt-1">
                                                                                            {permission === Permission.SEND_MESSAGES && "Allows members to send messages in text channels."}
                                                                                            {permission === Permission.MANAGE_CHANNELS && "Allows members to create, edit, or delete channels."}
                                                                                            {permission === Permission.MANAGE_ROLES && "Allows members to create new roles and edit or delete roles lower than their highest role."}
                                                                                            {permission === Permission.MANAGE_SERVER && "Allows members to change the server's name and other settings."}
                                                                                            {permission === Permission.DELETE_MESSAGES && "Allows members to delete messages from other users."}
                                                                                            {permission === Permission.KICK_MEMBERS && "Allows members to remove other members from this server."}
                                                                                            {permission === Permission.BAN_MEMBERS && "Allows members to permanently ban other members from this server."}
                                                                                            {permission === Permission.ADMINISTRATOR && "Members with this permission will have every permission and also bypass all channel specific permissions."}
                                                                                            {permission === Permission.MANAGE_NICKNAMES && "Allows members to change nicknames of other members."}
                                                                                            {permission === Permission.MANAGE_MEMBERS && "Allows members to manage other members' roles and permissions."}
                                                                                            {permission === Permission.MENTION_EVERYONE && "Allows members to use @everyone and @here mentions."}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex-shrink-0">
                                                                                        <button
                                                                                            type="button"
                                                                                            role="switch"
                                                                                            aria-checked={rolePermissions.includes(permission as Permission)}
                                                                                            onClick={() => togglePermission(permission as Permission)}
                                                                                            className={cn(
                                                                                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                                                                                rolePermissions.includes(permission as Permission)
                                                                                                    ? "bg-primary"
                                                                                                    : "bg-input"
                                                                                            )}
                                                                                        >
                                                                                            <span
                                                                                                className={cn(
                                                                                                    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                                                                                                    rolePermissions.includes(permission as Permission) ? "translate-x-6" : "translate-x-1"
                                                                                                )}
                                                                                            />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </TabsContent>

                                                                {/* Members Tab */}
                                                                <TabsContent value="members" className="m-0 h-full overflow-y-auto">
                                                                    <div className="p-6 space-y-6">
                                                                        <div className="flex items-center justify-between">
                                                                            <h4 className="text-lg font-semibold">Members with this role</h4>
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="text-sm text-muted-foreground">
                                                                                    {roleMembers.length} member{roleMembers.length !== 1 ? 's' : ''}
                                                                                </div>
                                                                                {isServerOwner && (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        onClick={() => setAddMemberDialogOpen(true)}
                                                                                        disabled={loadingRoleMembers}
                                                                                    >
                                                                                        <Plus className="w-4 h-4 mr-2" />
                                                                                        Add Member
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {renderRoleMembersSection()}
                                                                    </div>
                                                                </TabsContent>
                                                            </div>
                                                        </Tabs>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-center p-4">
                                                            <div className="text-center">
                                                                <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                                                                <h4 className="text-lg font-semibold mb-2">Select a role to edit</h4>
                                                                <p className="text-muted-foreground">Choose a role from the list to view and edit its settings</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Update Server Code Tab */}
                                <TabsContent value="update-code" className="p-8 space-y-8 m-0 h-full max-w-4xl">
                                    <div>
                                        <h3 className="text-2xl font-bold mb-3">Update Server Code</h3>
                                        <p className="text-muted-foreground text-lg">
                                            Update your server to the latest version of the Subspace protocol for new features and improvements.
                                        </p>
                                    </div>

                                    {/* Current Version Display */}
                                    <div className="p-6 bg-muted/30 rounded-xl border border-border/30">
                                        <h4 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <Code className="w-5 h-5 text-primary" />
                                            Current Version
                                        </h4>
                                        {loadingVersion ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                <span className="text-sm text-muted-foreground">Loading version...</span>
                                            </div>
                                        ) : serverVersion ? (
                                            <div className="flex items-center gap-3">
                                                <div className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 font-mono text-sm">
                                                    v{serverVersion}
                                                </div>
                                                <span className="text-sm text-muted-foreground">Currently running</span>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Unable to fetch version information
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 bg-green-500/5 rounded-xl border border-green-500/10">
                                        <h4 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <Code className="w-5 h-5 text-green-500" />
                                            What happens during the update:
                                        </h4>
                                        <ul className="text-sm text-muted-foreground space-y-2">
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                                                <span>Server will be updated to the latest protocol version</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                                                <span>New features and security improvements will be applied</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                                                <span>All data, messages, and settings will be preserved</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                                                <span>Update process is typically completed within minutes</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <Button onClick={() => setUpdateConfirmOpen(true)} className="h-12 px-8 text-base" size="lg">
                                        <Code className="w-4 h-4 mr-3" />
                                        Update Server Code
                                    </Button>
                                </TabsContent>

                                {/* Delete Server Tab */}
                                <TabsContent value="delete" className="p-8 space-y-8 m-0 h-full max-w-4xl">
                                    <div>
                                        <h3 className="text-2xl font-bold mb-3 text-destructive">Delete Server</h3>
                                        <p className="text-muted-foreground text-lg">
                                            Permanently delete this server. This action cannot be undone and will affect all server members.
                                        </p>
                                    </div>

                                    <div className="p-6 bg-destructive/5 rounded-xl border border-destructive/10">
                                        <h4 className="text-base font-semibold text-destructive mb-3 flex items-center gap-2">
                                            <Trash2 className="w-5 h-5" />
                                            ⚠️ Warning: This action is irreversible
                                        </h4>
                                        <ul className="text-sm text-muted-foreground space-y-2">
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                                                <span>This server will be permanently removed from Subspace</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                                                <span>All members will immediately lose access to the server</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                                                <span>Server data and messages will still exist on the permaweb</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                                                <span>This action cannot be undone or reversed</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <Button
                                        variant="destructive"
                                        onClick={() => setDeleteConfirmOpen(true)}
                                        className="h-12 px-8 text-base"
                                        size="lg"
                                    >
                                        <Trash2 className="w-4 h-4 mr-3" />
                                        Delete Server Permanently
                                    </Button>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Update Server Code Confirmation Dialog */}
            <AlertDialog open={updateConfirmOpen} onOpenChange={setUpdateConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Code className="w-5 h-5 text-green-500" />
                            Update Server Code
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will update "{server.name}" to the latest version of the Subspace protocol.
                            The server will get new features and improvements while preserving all data and settings.
                            Are you sure you want to continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isUpdating}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUpdateServerCode}
                            disabled={isUpdating}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {isUpdating ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Updating...
                                </div>
                            ) : (
                                "Update Server"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Role Dialog */}
            <AlertDialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Create Role
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Create a new role with a name and color. You can configure permissions after creation.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role Name</label>
                            <Input
                                placeholder="e.g. Moderator"
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={roleColor}
                                    onChange={(e) => setRoleColor(e.target.value)}
                                    className="w-10 h-10 rounded border border-border/50"
                                />
                                <Input
                                    value={roleColor}
                                    onChange={(e) => setRoleColor(e.target.value)}
                                    placeholder="#696969"
                                />
                            </div>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCreatingRole}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCreateRole}
                            disabled={isCreatingRole || !roleName.trim()}
                        >
                            {isCreatingRole ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Role"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Role Dialog */}
            <AlertDialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
                <AlertDialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Pencil className="w-5 h-5 text-primary" />
                            Edit Role
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Update the role's name, color, and permissions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role Name</label>
                                <Input
                                    placeholder="e.g. Moderator"
                                    value={roleName}
                                    onChange={(e) => setRoleName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role Color</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={roleColor}
                                        onChange={(e) => setRoleColor(e.target.value)}
                                        className="w-10 h-10 rounded border border-border/50"
                                    />
                                    <Input
                                        value={roleColor}
                                        onChange={(e) => setRoleColor(e.target.value)}
                                        placeholder="#696969"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium">Permissions</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                {Object.values(Permission).filter(p => typeof p === 'number').map((permission) => (
                                    <div key={permission} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`edit-perm-${permission}`}
                                            checked={rolePermissions.includes(permission as Permission)}
                                            onCheckedChange={() => togglePermission(permission as Permission)}
                                        />
                                        <label
                                            htmlFor={`edit-perm-${permission}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {Permission[permission as Permission]}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isEditingRole}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleEditRole}
                            disabled={isEditingRole || !roleName.trim()}
                        >
                            {isEditingRole ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                "Update Role"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Role Dialog */}
            <AlertDialog open={deleteRoleOpen} onOpenChange={setDeleteRoleOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Delete Role</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the role "{selectedRole?.name}"? This action cannot be undone and will remove this role from all users who have it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingRole}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteRole}
                            disabled={isDeletingRole}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeletingRole ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete Role"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Server Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Delete Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{server.name}"? This action cannot be undone.
                            Although the server will be removed from Subspace, the data and messages will still exist somewhere on the permaweb.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteServer}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeleting ? "Deleting..." : "Delete Server"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add Member to Role Dialog */}
            <CommandDialog
                open={addMemberDialogOpen}
                onOpenChange={setAddMemberDialogOpen}
                title="Add Member to Role"
                description={`Search and select a member to add to the "${selectedRole?.name}" role`}
            >
                <CommandInput placeholder="Search members..." disabled={loadingServerMembers || assigningRole} />
                <CommandList>
                    {loadingServerMembers ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span className="ml-3 text-muted-foreground">Loading members...</span>
                        </div>
                    ) : (
                        <>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup heading="Available Members">
                                {getAvailableMembers().map((member) => {
                                    const displayName = getDisplayName(member, profiles)
                                    const profile = profiles[member.userId]

                                    return (
                                        <CommandItem
                                            key={member.userId}
                                            value={`${displayName} ${member.userId} ${profile?.primaryName || ''}`}
                                            onSelect={() => handleAssignRole(member.userId)}
                                            disabled={assigningRole}
                                            className="flex items-center gap-3 p-3 cursor-pointer"
                                        >
                                            <MemberAvatar userId={member.userId} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    {displayName}
                                                </div>
                                                {(member.nickname || profile?.primaryName) && member.userId !== displayName && (
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {member.userId}
                                                    </div>
                                                )}
                                            </div>
                                            {assigningRole && (
                                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            )}
                                        </CommandItem>
                                    )
                                })}
                            </CommandGroup>
                        </>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    )
} 