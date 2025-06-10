import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Settings, LogOut, User, Edit2, Save, X, Upload, Camera, Import, Check, CheckCircle2, Image } from "lucide-react"
import { cn, shortenAddress, uploadFileTurbo } from "@/lib/utils"
import useSubspace, { useProfile, useServer } from "@/hooks/subspace"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet"
import { Link, NavLink } from "react-router"
import type { Profile } from "@/types/subspace"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import ArioBadge from "@/components/ario-badhe"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Permaweb from "@permaweb/libs"

interface UserProfileProps {
    className?: string
}

export default function UserProfile({ className }: UserProfileProps) {
    const { address, actions: walletActions, connectionStrategy, jwk } = useWallet()
    const { profiles, actions: profileActions } = useProfile()
    const { servers, activeServerId, actions: serverActions } = useServer()
    const subspace = useSubspace()

    // Selected server state
    const [selectedServerId, setSelectedServerId] = useState<string | null>(activeServerId || null)

    // Profile dialog state
    const [profileDialogOpen, setProfileDialogOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Nickname prompt dialog state
    const [nicknamePromptOpen, setNicknamePromptOpen] = useState(false)
    const [promptNickname, setPromptNickname] = useState("")
    const [isSavingPromptNickname, setIsSavingPromptNickname] = useState(false)
    const [hasBeenPromptedForNickname, setHasBeenPromptedForNickname] = useState(false)

    // Form state
    const [editedNickname, setEditedNickname] = useState("")
    const [profilePicFile, setProfilePicFile] = useState<File | string | null>(null)
    const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null)
    const [isUploadingPfp, setIsUploadingPfp] = useState(false)
    const [importOptions, setImportOptions] = useState<Record<string, string>>({})

    // Update selected server when dialog opens or active server changes
    useEffect(() => {
        if (profileDialogOpen && activeServerId) {
            setSelectedServerId(activeServerId)
        }
    }, [profileDialogOpen, activeServerId])

    useEffect(() => {
        if (address) {
            subspace.user.getProfile({ userId: address }).then(data => {
                if (data) {
                    profileActions.updateProfile(address, data as any)
                    subspace.user.getPrimaryName({ userId: address }).then(data => {
                        if (data) {
                            subspace.user.getPrimaryLogo({ userId: address }).then(logo => {
                                if (logo) {
                                    setImportOptions(prev => ({ ...prev, "Primary Logo": logo }))
                                }
                            })
                            profileActions.updateProfile(address, { primaryName: data } as any)
                        }
                    })
                }
            })
            const permaweb = Permaweb.init({})
            permaweb.getProfileByWalletAddress(address).then(data => {
                if (data && data.thumbnail) {
                    setImportOptions(prev => ({ ...prev, "Permaweb": data.thumbnail }))
                }
            })
        }
    }, [address])

    const profile = profiles[address] ? profiles[address] : null
    const server = activeServerId ? servers[activeServerId] : null
    const serverNickname = server && Object.prototype.toString.call(server.members) == "[object Array]" ? server?.members?.find(m => m.userId === address)?.nickname : null

    // Check if we should show the nickname prompt
    useEffect(() => {
        if (activeServerId && address && !profile?.primaryName && !serverNickname && !nicknamePromptOpen && !profileDialogOpen && !hasBeenPromptedForNickname) {
            setNicknamePromptOpen(true)
            setHasBeenPromptedForNickname(true)
        }
    }, [activeServerId, address, profile?.primaryName, serverNickname, nicknamePromptOpen, profileDialogOpen, hasBeenPromptedForNickname])

    // Reset the prompt flag when switching servers or when a nickname is set
    useEffect(() => {
        setHasBeenPromptedForNickname(false)
    }, [activeServerId, serverNickname])

    // Get the selected server's nickname
    const getSelectedServerNickname = () => {
        if (!selectedServerId || !servers[selectedServerId]) return ""
        return servers[selectedServerId].members?.find(m => m.userId === address)?.nickname || ""
    }

    // Initialize form state when dialog opens or server changes
    useEffect(() => {
        if (profileDialogOpen || selectedServerId) {
            setEditedNickname(getSelectedServerNickname())
            setProfilePicFile(null)
            setProfilePicPreview(null)
            setIsUploadingPfp(false)
            setIsEditing(false)
        }
    }, [profileDialogOpen, selectedServerId])

    // Update edited nickname when server changes or editing starts
    useEffect(() => {
        setEditedNickname(getSelectedServerNickname())
    }, [selectedServerId, isEditing])

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedNickname(getSelectedServerNickname())
        setProfilePicFile(null)
        setProfilePicPreview(null)
        setIsUploadingPfp(false)
    }

    // Get display name
    const getDisplayName = () => {
        if (serverNickname) return serverNickname
        if (profile?.primaryName) return profile.primaryName
        if (address) return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
        return 'Not Connected'
    }

    const handleSignOut = () => {
        walletActions.disconnect()
        toast.success("Signed out successfully")
    }

    const handleOpenProfile = () => {
        setProfileDialogOpen(true)
    }

    const handleOpenSettings = () => {
        toast.info("User settings coming soon!")
    }

    // Format file size for display
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const handleProfilePicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            // Check file size (100KB limit)
            if (file.size > 100 * 1024) {
                toast.error("Profile picture must be less than 100KB")
                return
            }

            // Check file type (only PNG and JPEG)
            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
                toast.error("Please select a PNG or JPEG image file")
                return
            }

            setProfilePicFile(file)

            // Create preview
            const reader = new FileReader()
            reader.onload = (e) => {
                setProfilePicPreview(e.target?.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSaveProfile = async () => {
        if (!address) return

        setIsSaving(true)
        try {
            let profileUpdated = false

            // Upload and update profile picture if changed
            if (profilePicFile) {
                try {
                    setIsUploadingPfp(true)
                    toast.loading("Uploading profile picture to Arweave...")
                    let pfpId: string | null = null;
                    if (typeof profilePicFile == "string") {
                        pfpId = profilePicFile
                    }
                    else {
                        pfpId = await (connectionStrategy == ConnectionStrategies.ScannedJWK ? uploadFileTurbo(profilePicFile, jwk) : uploadFileTurbo(profilePicFile))
                    }
                    if (pfpId) {
                        toast.dismiss()
                        toast.loading("Updating profile...")

                        const success = await subspace.user.updateProfile({ pfp: pfpId })
                        if (success) {
                            toast.dismiss()
                            toast.success("Profile picture updated successfully")
                            profileUpdated = true

                            // Update local profile state
                            profileActions.updateProfile(address, { pfp: pfpId } as any)
                        } else {
                            toast.dismiss()
                            toast.error("Failed to update profile picture")
                        }
                    } else {
                        toast.dismiss()
                        toast.error("Failed to upload profile picture")
                    }
                } catch (error) {
                    console.error("Error uploading profile picture:", error)
                    toast.dismiss()
                    toast.error("Failed to upload profile picture")
                } finally {
                    setIsUploadingPfp(false)
                }
            }

            // Update server nickname if changed
            if (selectedServerId && editedNickname !== serverNickname) {
                const success = await subspace.server.updateMember({
                    serverId: selectedServerId,
                    nickname: editedNickname
                })
                if (success) {
                    toast.success("Nickname updated successfully")
                    // Update local state
                    const updatedMembers = servers[selectedServerId].members.map(member =>
                        member.userId === address
                            ? { ...member, nickname: editedNickname }
                            : member
                    ) || []
                    serverActions.updateServerMembers(selectedServerId, updatedMembers)
                } else {
                    toast.error("Failed to update nickname")
                }
            }

            setIsEditing(false)
            setProfilePicFile(null)
            setProfilePicPreview(null)
        } catch (error) {
            console.error("Error updating profile:", error)
            toast.error("Failed to update profile")
        } finally {
            setIsSaving(false)
        }
    }

    const handleSavePromptNickname = async () => {
        if (!activeServerId || !address || !promptNickname.trim()) return

        setIsSavingPromptNickname(true)
        try {
            const success = await subspace.server.updateMember({
                serverId: activeServerId,
                nickname: promptNickname.trim()
            })

            if (success) {
                toast.success("Nickname set successfully!")
                // Update local state
                const updatedMembers = server?.members.map(member =>
                    member.userId === address
                        ? { ...member, nickname: promptNickname.trim() }
                        : member
                ) || []
                serverActions.updateServerMembers(activeServerId, updatedMembers)
                setNicknamePromptOpen(false)
                setPromptNickname("")
            } else {
                toast.error("Failed to set nickname")
            }
        } catch (error) {
            console.error("Error setting nickname:", error)
            toast.error("Failed to set nickname")
        } finally {
            setIsSavingPromptNickname(false)
        }
    }

    if (!address) return null

    return (
        <>
            <div className={cn("bg-background/50 backdrop-blur-sm", className)}>
                <div className="p-2 flex items-center justify-between gap-2">
                    {/* Profile Button */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="flex items-center gap-2 p-2 h-auto hover:bg-muted/30 transition-colors grow"
                            >
                                {/* User Avatar */}
                                <div className="relative flex-shrink-0">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                                        {profile?.pfp ? (
                                            <img
                                                src={`https://arweave.net/${profile.pfp}`}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-primary font-semibold text-xs">
                                                {getDisplayName().charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    {/* Online status indicator */}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                                </div>

                                {/* User Info */}
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="text-sm font-medium text-foreground truncate">
                                        {getDisplayName()}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span className="truncate">{shortenAddress(address)}</span>
                                    </div>
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-64 p-2 space-y-1 bg-background/95 backdrop-blur-sm border border-border/50"
                            sideOffset={4}
                        >
                            <DropdownMenuItem
                                id="open-profile-editor"
                                onClick={handleOpenProfile}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md transition-colors"
                            >
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Profile</p>
                                    <p className="text-xs text-muted-foreground">View and edit your profile</p>
                                </div>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-2" />

                            <DropdownMenuItem
                                onClick={handleSignOut}
                                className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-destructive/10 rounded-md transition-colors text-destructive"
                            >
                                <LogOut className="h-4 w-4" />
                                <div>
                                    <p className="font-medium">Sign Out</p>
                                    <p className="text-xs text-muted-foreground">Disconnect from Subspace</p>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>


                    {/* Settings Button */}
                    <NavLink to="/app/settings">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="User Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </NavLink>
                </div>
            </div>

            {/* Profile Settings Dialog */}
            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] outline-0 overflow-hidden flex flex-col" removeCloseButton>
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="flex items-center justify-between">
                            <span>Profile Settings</span>
                            {!isEditing ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2"
                                >
                                    <Edit2 className="h-4 w-4" />
                                    <span className="hidden sm:inline">Edit</span>
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        disabled={isSaving || isUploadingPfp}
                                        className="flex items-center gap-2"
                                    >
                                        <X className="h-4 w-4" />
                                        <span className="hidden sm:inline">Cancel</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveProfile}
                                        disabled={isSaving || isUploadingPfp}
                                        className="flex items-center gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        <span className="hidden sm:inline">
                                            {isUploadingPfp ? "Uploading..." : isSaving ? "Saving..." : "Save"}
                                        </span>
                                        <span className="sm:hidden">
                                            {isUploadingPfp ? "..." : isSaving ? "..." : "Save"}
                                        </span>
                                    </Button>
                                </div>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Manage your global profile and server-specific settings.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                        <Tabs defaultValue="global" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="global" className="text-xs sm:text-sm">Global Profile</TabsTrigger>
                                <TabsTrigger value="server" className="text-xs sm:text-sm">
                                    <span className="hidden sm:inline">Server Profile</span>
                                    <span className="sm:hidden">Server</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="global" className="space-y-6 mt-6">
                                {/* Profile Picture Section */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                        <div className="relative group">
                                            <div className={`w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-all duration-200 ${isEditing
                                                ? 'border-2 border-dashed border-primary/40 group-hover:border-primary/60 group-hover:scale-105 cursor-pointer shadow-lg group-hover:shadow-xl'
                                                : 'border-2 border-transparent'
                                                }`}>
                                                {profilePicPreview ? (
                                                    <img
                                                        src={profilePicPreview}
                                                        alt="Profile Preview"
                                                        className={`w-full h-full object-cover transition-all duration-200 ${isEditing ? 'group-hover:brightness-75' : ''
                                                            }`}
                                                    />
                                                ) : profile?.pfp ? (
                                                    <img
                                                        src={`https://arweave.net/${profile.pfp}`}
                                                        alt="Profile"
                                                        className={`w-full h-full object-cover transition-all duration-200 ${isEditing ? 'group-hover:brightness-75' : ''
                                                            }`}
                                                    />
                                                ) : (
                                                    <span className={`text-primary font-semibold text-2xl transition-all duration-200 ${isEditing ? 'group-hover:opacity-50' : ''
                                                        }`}>
                                                        {getDisplayName().charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            {isEditing && (
                                                <>
                                                    <label className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Camera className="h-6 w-6 text-white" />
                                                            <span className="text-xs text-white font-medium">Upload</span>
                                                        </div>
                                                        <input
                                                            type="file"
                                                            accept="image/png,image/jpeg,image/jpg"
                                                            onChange={handleProfilePicChange}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    {/* Invisible clickable overlay for better UX */}
                                                    <label className="absolute inset-0 cursor-pointer z-10">
                                                        <input
                                                            type="file"
                                                            accept="image/png,image/jpeg,image/jpg"
                                                            onChange={handleProfilePicChange}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    {/* Always visible upload indicator when in edit mode */}
                                                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg border-2 border-background z-20">
                                                        <Camera className="h-3 w-3" />
                                                    </div>
                                                    {/* Pulsing animation to draw attention */}
                                                    <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse z-0"></div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex-1 text-center sm:text-left">
                                            <h3 className="text-lg font-semibold">Profile Picture</h3>
                                            {!profilePicFile && <p className="text-sm text-muted-foreground">
                                                {isEditing
                                                    ? "Click on your avatar to upload a new profile picture (max 100KB)"
                                                    : "Your profile picture is visible across all servers"
                                                }
                                            </p>}
                                            {isEditing && (
                                                <div className="space-y-1 mt-1">
                                                    {!profilePicFile && <p className="text-xs text-muted-foreground">
                                                        Supported formats: PNG, JPEG • Max size: 100KB
                                                    </p>}
                                                    {profilePicFile && typeof profilePicFile == "object" && (
                                                        <p className="text-xs text-green-600 dark:text-green-400">
                                                            Selected: {profilePicFile.name} ({formatFileSize(profilePicFile.size)})
                                                        </p>
                                                    )}
                                                    {profilePicFile && typeof profilePicFile == "string" && (
                                                        <p className="text-xs text-green-600 dark:text-green-400 truncate whitespace-normal">
                                                            Selected: {profilePicFile}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {isEditing && <div>
                                        <div>Import from other apps</div>
                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            {Object.entries(importOptions).map(([source, id]) => (
                                                <div key={id} data-selected={profile?.pfp === id}
                                                    className="flex items-center gap-2 cursor-pointer rounded-md p-2 bg-primary/10 hover:bg-primary/20 data-[selected=true]:bg-primary/20 transition-colors duration-150 border border-transparent hover:border-primary/40  relative"
                                                    onClick={() => {
                                                        setProfilePicPreview(`https://arweave.net/${id}`)
                                                        setProfilePicFile(id)
                                                    }}>
                                                    <img src={`https://arweave.net/${id}`} alt={source} className="w-10 h-10 rounded-full" />
                                                    <p className="truncate w-full text-center">{source}</p>
                                                    {profile?.pfp === id && <CheckCircle2 className="w-4 h-4 text-green-500 absolute top-1 right-1" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>}
                                </div>

                                {/* Primary Name Section */}
                                <div className="space-y-2">
                                    <Label className="text-base font-medium">Primary Name</Label>
                                    <div className="p-3 bg-muted/30 rounded-md border">
                                        <p className="text-sm break-all">
                                            {profile?.primaryName || (
                                                <span className="text-muted-foreground italic">No primary name set</span>
                                            )}
                                        </p>
                                        {!profile?.primaryName && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Get your own Primary Name at{" "}
                                                <a
                                                    href="https://arns.ar.io"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    arns.ar.io
                                                </a>
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        Primary names can be bought from the <Link to="https://arns.ar.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ArNS registry</Link> <ArioBadge className="w-4 h-4" />
                                    </p>
                                </div>

                                {/* Wallet Address Section */}
                                {/* <div className="space-y-2">
                                    <Label className="text-base font-medium">Wallet Address</Label>
                                    <div className="p-3 bg-muted/30 rounded-md border">
                                        <p className="text-sm font-mono break-all">{address}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Your unique wallet address on the Arweave network.
                                    </p>
                                </div> */}
                            </TabsContent>

                            <TabsContent value="server" className="space-y-6 mt-6">
                                {/* Server Selector */}
                                <div className="space-y-2">
                                    <Label htmlFor="server-selector" className="text-base font-medium">
                                        Select Server
                                    </Label>
                                    <Select
                                        value={selectedServerId || undefined}
                                        onValueChange={(value) => setSelectedServerId(value)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choose a server" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(servers).map(([id, server]) => (
                                                <SelectItem key={id} value={id}>
                                                    {server.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {Object.keys(servers).length === 0 && (
                                        <p className="text-sm text-muted-foreground mt-2">
                                            You haven't joined any servers yet. Join a server to set server-specific nicknames.
                                        </p>
                                    )}
                                </div>

                                {selectedServerId && servers[selectedServerId] ? (
                                    <>
                                        {/* Server Info */}
                                        {/* <div className="p-3 bg-muted/30 rounded-md border">
                                            <h3 className="font-medium text-sm text-muted-foreground">Selected Server</h3>
                                            <p className="text-base font-medium break-all">{servers[selectedServerId].name}</p>
                                        </div> */}

                                        {/* Server Nickname Section */}
                                        <div className="space-y-2">
                                            <Label htmlFor="server-nickname" className="text-base font-medium">
                                                Server Nickname
                                            </Label>
                                            {isEditing ? (
                                                <Input
                                                    id="server-nickname"
                                                    value={editedNickname}
                                                    onChange={(e) => setEditedNickname(e.target.value)}
                                                    placeholder="Enter a nickname for this server"
                                                    className="w-full"
                                                />
                                            ) : (
                                                <div className="p-3 bg-muted/30 rounded-md border">
                                                    <p className="text-sm break-all">
                                                        {getSelectedServerNickname() || (
                                                            <span className="text-muted-foreground italic">No nickname set</span>
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                This nickname will only be visible to members of {servers[selectedServerId].name}.
                                            </p>
                                        </div>

                                        {/* Server Profile Picture Note */}
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                                <strong>Note:</strong> Your profile picture is shared across all servers.
                                                Update it in the Global Profile tab.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-muted-foreground">
                                            Select a server to view and manage server-specific profile settings.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 pt-4 border-t border-border/50 bg-background/95 backdrop-blur-sm flex-shrink-0">
                        <DialogClose className="cursor-pointer">
                            Close
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Nickname Prompt Dialog */}
            <Dialog open={nicknamePromptOpen} onOpenChange={setNicknamePromptOpen}>
                <DialogContent className="max-w-md w-[95vw] sm:w-full" removeCloseButton>
                    <DialogHeader>
                        <DialogTitle>Set Your Nickname</DialogTitle>
                        <DialogDescription>
                            <div>
                                You've joined <strong>{server?.name}</strong>! Set a nickname to personalize your presence on this server.
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                <ArioBadge className="w-5 h-5" />
                                You can also set a primary name for your profile at
                                <Link to="https://arns.ar.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">arns.ar.io</Link>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="prompt-nickname">Server Nickname</Label>
                            <Input
                                id="prompt-nickname"
                                value={promptNickname}
                                onChange={(e) => setPromptNickname(e.target.value)}
                                placeholder="Enter your nickname"
                                className="w-full"
                                maxLength={50}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && promptNickname.trim()) {
                                        handleSavePromptNickname()
                                    }
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                This nickname will only be visible to members of this server.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setNicknamePromptOpen(false)}
                            disabled={isSavingPromptNickname}
                            className="w-full sm:w-auto"
                        >
                            Skip for now
                        </Button>
                        <Button
                            onClick={handleSavePromptNickname}
                            disabled={!promptNickname.trim() || isSavingPromptNickname}
                            className="w-full sm:w-auto"
                        >
                            {isSavingPromptNickname ? "Setting..." : "Set Nickname"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
