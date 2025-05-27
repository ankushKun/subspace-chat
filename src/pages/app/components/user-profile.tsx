import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Settings, LogOut, User, Edit2, Save, X, Upload, Camera } from "lucide-react"
import { cn, shortenAddress, uploadFileAR } from "@/lib/utils"
import useSubspace, { useProfile, useServer } from "@/hooks/subspace"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useWallet } from "@/hooks/use-wallet"
import { NavLink } from "react-router"
import type { Profile } from "@/types/subspace"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface UserProfileProps {
    className?: string
}

export default function UserProfile({ className }: UserProfileProps) {
    const { address, actions: walletActions } = useWallet()
    const { profiles, actions: profileActions } = useProfile()
    const { servers, activeServerId, actions: serverActions } = useServer()
    const subspace = useSubspace()

    // Profile dialog state
    const [profileDialogOpen, setProfileDialogOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [editedNickname, setEditedNickname] = useState("")
    const [profilePicFile, setProfilePicFile] = useState<File | null>(null)
    const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null)
    const [isUploadingPfp, setIsUploadingPfp] = useState(false)

    useEffect(() => {
        if (address) {
            subspace.user.getPrimaryName({ userId: address }).then(data => {
                if (data) {
                    profileActions.updateProfile(address, { primaryName: data } as any)
                }
            })
        }
    }, [address])

    const profile = profiles[address] ? profiles[address] : null
    const server = activeServerId ? servers[activeServerId] : null
    const serverNickname = server?.members.find(m => m.userId === address)?.nickname

    // Initialize form state when dialog opens
    useEffect(() => {
        if (profileDialogOpen) {
            setEditedNickname(serverNickname || "")
            setProfilePicFile(null)
            setProfilePicPreview(null)
            setIsUploadingPfp(false)
            setIsEditing(false)
        }
    }, [profileDialogOpen, serverNickname])

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
                    const pfpId = await uploadFileAR(profilePicFile)

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
            if (activeServerId && editedNickname !== serverNickname) {
                const success = await subspace.server.updateMember({
                    serverId: activeServerId,
                    nickname: editedNickname
                })
                if (success) {
                    toast.success("Nickname updated successfully")
                    // Update local state
                    const updatedMembers = server?.members.map(member =>
                        member.userId === address
                            ? { ...member, nickname: editedNickname }
                            : member
                    ) || []
                    serverActions.updateServerMembers(activeServerId, updatedMembers)
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

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedNickname(serverNickname || "")
        setProfilePicFile(null)
        setProfilePicPreview(null)
        setIsUploadingPfp(false)
    }

    if (!address) return null

    return (
        <>
            <div className={cn("border-t border-border/30 bg-background/50 backdrop-blur-sm", className)}>
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
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden" removeCloseButton>
                    <DialogHeader>
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
                                    Edit
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
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveProfile}
                                        disabled={isSaving || isUploadingPfp}
                                        className="flex items-center gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        {isUploadingPfp ? "Uploading..." : isSaving ? "Saving..." : "Save"}
                                    </Button>
                                </div>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Manage your global profile and server-specific settings.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto">
                        <Tabs defaultValue="global" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="global">Global Profile</TabsTrigger>
                                <TabsTrigger value="server" disabled={!activeServerId}>
                                    Server Profile
                                    {!activeServerId && <span className="ml-1 text-xs">(No server)</span>}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="global" className="space-y-6 mt-6">
                                {/* Profile Picture Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
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
                                                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-200">
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
                                                    {/* Always visible upload indicator when in edit mode */}
                                                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg border-2 border-background">
                                                        <Camera className="h-3 w-3" />
                                                    </div>
                                                    {/* Pulsing animation to draw attention */}
                                                    <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse"></div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold">Profile Picture</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {isEditing
                                                    ? "Click on your avatar to upload a new profile picture (max 100KB)"
                                                    : "Your profile picture is visible across all servers"
                                                }
                                            </p>
                                            {isEditing && (
                                                <div className="space-y-1 mt-1">
                                                    <p className="text-xs text-muted-foreground">
                                                        Supported formats: PNG, JPEG • Max size: 100KB
                                                    </p>
                                                    {profilePicFile && (
                                                        <p className="text-xs text-green-600 dark:text-green-400">
                                                            Selected: {profilePicFile.name} ({formatFileSize(profilePicFile.size)})
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Primary Name Section */}
                                <div className="space-y-2">
                                    <Label className="text-base font-medium">Primary Name</Label>
                                    <div className="p-3 bg-muted/30 rounded-md border">
                                        <p className="text-sm">
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
                                    <p className="text-xs text-muted-foreground">
                                        Primary names cannot be edited here. Manage them on the ArNS registry.
                                    </p>
                                </div>

                                {/* Wallet Address Section */}
                                <div className="space-y-2">
                                    <Label className="text-base font-medium">Wallet Address</Label>
                                    <div className="p-3 bg-muted/30 rounded-md border">
                                        <p className="text-sm font-mono break-all">{address}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Your unique wallet address on the Arweave network.
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="server" className="space-y-6 mt-6">
                                {activeServerId && server ? (
                                    <>
                                        {/* Server Info */}
                                        <div className="p-3 bg-muted/30 rounded-md border">
                                            <h3 className="font-medium text-sm text-muted-foreground">Current Server</h3>
                                            <p className="text-base font-medium">{server.name}</p>
                                        </div>

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
                                                    <p className="text-sm">
                                                        {serverNickname || (
                                                            <span className="text-muted-foreground italic">No nickname set</span>
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                This nickname will only be visible to members of {server.name}.
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
                                            Join a server to manage server-specific profile settings.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter>
                        {/* <DialogCancel onClick={() => setProfileDialogOpen(false)}>
                            Close
                        </DialogCancel> */}
                        <DialogClose className="cursor-pointer">
                            Close
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
