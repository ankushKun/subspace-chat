import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Settings, LogOut, User } from "lucide-react"
import { cn, shortenAddress } from "@/lib/utils"
import useSubspace, { useProfile, useServer } from "@/hooks/subspace"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useWallet } from "@/hooks/use-wallet"
import { NavLink } from "react-router"
import type { Profile } from "@/types/subspace"

interface UserProfileProps {
    className?: string
}

export default function UserProfile({ className }: UserProfileProps) {
    const { address, actions: walletActions } = useWallet()
    const { profiles, actions: profileActions } = useProfile()
    const { servers, activeServerId } = useServer()
    const subspace = useSubspace()

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


    // Get display name
    const getDisplayName = () => {
        if (serverNickname) return serverNickname
        if (profile?.primaryName) return profile.primaryName
        // if (profile?.username) return profile.username
        if (address) return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
        return 'Not Connected'
    }

    const handleSignOut = () => {
        walletActions.disconnect()
        toast.success("Signed out successfully")
    }

    const handleOpenProfile = () => {
        // TODO: Open profile modal/dialog
        toast.info("Profile settings coming soon!")
    }

    const handleOpenSettings = () => {
        // TODO: Navigate to settings or open settings modal
        toast.info("User settings coming soon!")
    }

    if (!address) return null

    return (
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
                                    {/* <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span> */}
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
    )
}
