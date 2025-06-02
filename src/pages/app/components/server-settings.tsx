import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Link, Plus, Hash, Settings, Code, Trash2, Loader2, X, User, Shield, Upload } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { toast } from "sonner"
import useSubspace from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import { uploadFileAR, cn } from "@/lib/utils"
import type { Server } from "@/types/subspace"

interface ServerSettingsProps {
    server: Server
    isServerOwner: boolean
    onCreateCategory: () => void
    onCreateChannel: (categoryId?: number) => void
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
                                            className="w-full justify-start gap-4 h-14 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/50 transition-all text-destructive data-[state=active]:text-destructive"
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
                                <TabsContent value="roles" className="p-8 space-y-8 m-0 h-full max-w-4xl">
                                    <div>
                                        <h3 className="text-2xl font-bold mb-3">Roles & Permissions</h3>
                                        <p className="text-muted-foreground text-lg">
                                            Manage server roles and user permissions.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center h-96 border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                                        <div className="text-center">
                                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                                <Shield className="w-8 h-8 text-primary/50" />
                                            </div>
                                            <h4 className="text-lg font-semibold mb-2">Roles Management</h4>
                                            <p className="text-muted-foreground">This feature is coming soon</p>
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

                                    <Button onClick={handleUpdateServerCode} className="h-12 px-8 text-base" size="lg">
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
        </>
    )
} 