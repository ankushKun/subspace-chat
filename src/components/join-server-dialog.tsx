import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import useSubspace from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import { toast } from "sonner"
import type { Server } from "@/types/subspace"
import { useWelcomePopup } from "@/hooks/use-welcome-popup"
import WelcomePopup from "@/components/welcome-popup"

const sampleInvites = [
    "wLedDuEphwwvxLS-ftFb4mcXhqu4jwkYtIM4txCx2V8",
    "subspace.ar.io/#/invite/wLedDuEphwwvxLS-ftFb4mcXhqu4jwkYtIM4txCx2V8"
]

export interface WelcomePopupData {
    serverId: string;
    serverName: string;
    memberCount: number;
}

interface JoinServerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialInput?: string;
    onServerJoined?: (data: WelcomePopupData) => void;
}

export function JoinServerDialog({ open, onOpenChange, initialInput = "", onServerJoined }: JoinServerDialogProps) {
    const [joinInput, setJoinInput] = useState(initialInput)
    const [isJoining, setIsJoining] = useState(false)
    const [joinError, setJoinError] = useState("")

    // Server preview state
    const [isLoadingServerDetails, setIsLoadingServerDetails] = useState(false)
    const [serverDetails, setServerDetails] = useState<any>(null)
    const [serverDetailsError, setServerDetailsError] = useState("")

    // Welcome popup state
    const { showWelcomePopup, welcomeData, showWelcome, hideWelcome } = useWelcomePopup()

    const subspace = useSubspace()
    const { address } = useWallet()
    const { actions: serverActions, serversJoined } = useServer()

    // Update input when initialInput changes
    useEffect(() => {
        if (initialInput && initialInput !== joinInput) {
            setJoinInput(initialInput)
        }
    }, [initialInput])

    // Clear state when dialog opens or initialInput changes
    useEffect(() => {
        if (open) {
            // Clear all previous state for a fresh start
            setJoinError("")
            setServerDetails(null)
            setServerDetailsError("")
            setIsLoadingServerDetails(false)

            // Set the input to the initial value
            if (initialInput) {
                setJoinInput(initialInput)
            }
        }
    }, [open, initialInput])

    // Reset state when dialog closes - aggressive cleanup
    useEffect(() => {
        if (!open) {
            // Completely reset all state when dialog closes
            setJoinInput("")
            setJoinError("")
            setServerDetails(null)
            setServerDetailsError("")
            setIsLoadingServerDetails(false)
        }
    }, [open])

    // Separate effect to handle initialInput updates when dialog is open
    useEffect(() => {
        if (open && initialInput) {
            setJoinInput(initialInput)
            // Force clear server details to ensure refetch
            setServerDetails(null)
            setServerDetailsError("")
            setIsLoadingServerDetails(false)
        }
    }, [open, initialInput])

    // Debounced server details fetching
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (joinInput.trim() && getInputValidation().isValid) {
                fetchServerDetails()
            } else {
                setServerDetails(null)
                setServerDetailsError("")
            }
        }, 500) // 500ms debounce

        return () => clearTimeout(timeoutId)
    }, [joinInput]) // Only depend on joinInput to ensure it always fetches

    const fetchServerDetails = async () => {
        if (!joinInput.trim()) return

        // Extract server ID from input
        let serverId = joinInput.trim()
        if (serverId.includes('/')) {
            const parts = serverId.split('/')
            serverId = parts[parts.length - 1]
        }

        // Clear previous state before starting new fetch
        setIsLoadingServerDetails(true)
        setServerDetailsError("")
        setServerDetails(null)

        try {
            const details = await subspace.server.getServerDetails({ serverId })
            if (details) {
                setServerDetails(details)
                setServerDetailsError("")
            } else {
                setServerDetailsError("Server not found or invite is invalid")
                setServerDetails(null)
            }
        } catch (error) {
            console.error("Error fetching server details:", error)
            setServerDetailsError("Failed to load server information")
            setServerDetails(null)
        } finally {
            setIsLoadingServerDetails(false)
        }
    }

    const handleJoinServer = async () => {
        if (!joinInput.trim()) {
            setJoinError("Please enter a server ID or invite link")
            return
        }

        if (!address) {
            setJoinError("Please connect your wallet first")
            return
        }

        if (!serverDetails) {
            setJoinError("Server details not loaded. Please wait for the server to load.")
            return
        }

        setIsJoining(true)
        setJoinError("")

        try {
            // Extract server ID from input (handle both direct IDs and invite links)
            let serverId = joinInput.trim()

            // If it's an invite link, extract the server ID
            if (serverId.includes('/')) {
                const parts = serverId.split('/')
                serverId = parts[parts.length - 1]
            }

            // Check if user is already in this server
            const currentServers = Array.isArray(serversJoined[address]) ? serversJoined[address] : []
            if (currentServers.includes(serverId)) {
                setJoinError("You are already a member of this server")
                return
            }

            // Call the actual joinServer method from the user service
            const success = await subspace.user.joinServer({ serverId })

            if (success) {
                // Update the local state to include the new server
                if (!currentServers.includes(serverId)) {
                    serverActions.setServersJoined(address, [...currentServers, serverId])
                }

                // Use the already fetched server details
                const server: Server = {
                    serverId,
                    ...serverDetails
                }
                serverActions.addServer(server)

                // Close the join dialog first
                onOpenChange(false)

                // Show welcome popup with server details
                showWelcome({
                    serverId,
                    serverName: serverDetails.name || `Server ${serverId.substring(0, 8)}...`,
                    memberCount: serverDetails.member_count || 0
                })

                // Call the optional callback if provided
                if (onServerJoined) {
                    onServerJoined({
                        serverId,
                        serverName: serverDetails.name || `Server ${serverId.substring(0, 8)}...`,
                        memberCount: serverDetails.member_count || 0
                    })
                }

                // Reset form
                setJoinInput("")
                setJoinError("")

                toast.success("Successfully joined server!", {
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
            } else {
                setJoinError("Failed to join server. The server may not exist.")
            }
        } catch (error) {
            console.error("Error joining server:", error)

            // Check if the error is about already being in the server
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes("Already joined server")) {
                setJoinError("You are already a member of this server")
            } else {
                setJoinError("Failed to join server. Please check the ID and try again.")
            }
        } finally {
            setIsJoining(false)
        }
    }

    const isValidInput = joinInput.trim().length > 0
    const inputType = joinInput.includes('/') ? 'invite link' : 'server ID'

    // Enhanced validation for server ID length
    const getInputValidation = () => {
        if (!joinInput.trim()) return { isValid: false, message: "" }

        let serverId = joinInput.trim()
        if (serverId.includes('/')) {
            const parts = serverId.split('/')
            serverId = parts[parts.length - 1]
        }

        if (serverId.length !== 43) {
            return {
                isValid: false,
                message: `Server ID must be 43 characters (current: ${serverId.length})`
            }
        }

        const serverIdRegex = /^[A-Za-z0-9_-]+$/
        if (!serverIdRegex.test(serverId)) {
            return {
                isValid: false,
                message: "Server ID contains invalid characters"
            }
        }

        return { isValid: true, message: "" }
    }

    const inputValidation = getInputValidation()
    const isValidForSubmission = inputValidation.isValid && serverDetails && !isLoadingServerDetails

    return (
        <>
            <AlertDialog open={open} onOpenChange={onOpenChange}>
                <AlertDialogContent className="max-w-md w-[95vw] sm:w-full p-0 max-h-[95vh] overflow-hidden flex flex-col">
                    <div className="relative overflow-hidden flex-shrink-0">
                        {/* Header with gradient */}
                        <AlertDialogHeader className="relative px-6 pt-6 pb-4">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 rounded-t-lg" />
                            <AlertDialogTitle className="text-xl font-bold flex items-center gap-3 relative">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <div>Join Server</div>
                                    <div className="text-sm font-normal text-muted-foreground mt-1">
                                        Connect to an existing community
                                    </div>
                                </div>
                            </AlertDialogTitle>
                        </AlertDialogHeader>

                        <AlertDialogDescription asChild>
                            <div className="px-4 sm:px-6 space-y-4 mt-4 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-foreground">
                                        Server ID or Invite Link
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            placeholder="Enter server ID or paste invite link..."
                                            value={joinInput}
                                            onChange={(e) => {
                                                setJoinInput(e.target.value)
                                                setJoinError("")
                                            }}
                                            className={cn(
                                                "pr-20 transition-all duration-200",
                                                joinError
                                                    ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                                    : inputValidation.isValid
                                                        ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                                                        : isValidInput && !inputValidation.isValid
                                                            ? "border-yellow-500/50 focus:border-yellow-500 focus:ring-yellow-500/20"
                                                            : ""
                                            )}
                                            disabled={isJoining}
                                        />
                                        {isValidInput && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className={cn(
                                                    "px-2 py-1 rounded text-xs transition-colors",
                                                    inputValidation.isValid
                                                        ? "bg-green-500/10 text-green-600 border border-green-500/20"
                                                        : "bg-muted text-muted-foreground"
                                                )}>
                                                    {inputType}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Real-time validation feedback */}
                                    {isValidInput && !inputValidation.isValid && !joinError && !serverDetailsError && (
                                        <p className="text-sm text-yellow-600 flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                            </div>
                                            {inputValidation.message}
                                        </p>
                                    )}

                                    {/* Server loading state */}
                                    {inputValidation.isValid && isLoadingServerDetails && (
                                        <p className="text-sm text-blue-600 flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                            </div>
                                            Loading server details...
                                        </p>
                                    )}

                                    {/* Server details error */}
                                    {serverDetailsError && (
                                        <p className="text-sm text-red-500 flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                            </div>
                                            {serverDetailsError}
                                        </p>
                                    )}

                                    {joinError && (
                                        <p className="text-sm text-red-500 flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                            </div>
                                            {joinError}
                                        </p>
                                    )}

                                    {inputValidation.isValid && !isLoadingServerDetails && !serverDetailsError && !serverDetails && (
                                        <p className="text-sm text-green-600 flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                            </div>
                                            Valid server ID format
                                        </p>
                                    )}
                                </div>

                                {/* Server Preview */}
                                {serverDetails && (
                                    <div className="p-4 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 rounded-lg border border-blue-500/20">
                                        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            Server Preview
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            {/* Server Icon */}
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
                                                {serverDetails.icon ? (
                                                    <img
                                                        src={`https://arweave.net/${serverDetails.icon}`}
                                                        alt={serverDetails.name || 'Server'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-lg font-bold text-primary">
                                                        {(serverDetails.name || 'S').charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Server Info */}
                                            <div className="flex-1 min-w-0">
                                                <h5 className="font-semibold text-foreground truncate">
                                                    {serverDetails.name || `Server ${joinInput.split('/').pop()?.substring(0, 8)}...`}
                                                </h5>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                    <Users className="w-3 h-3" />
                                                    <span>
                                                        {serverDetails.member_count} {serverDetails.member_count === 1 ? 'member' : 'members'}
                                                    </span>
                                                    <div className="w-1 h-1 rounded-full bg-green-500" />
                                                    <span>Online</span>
                                                </div>
                                                {serverDetails.description && (
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                        {serverDetails.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Already member check */}
                                        {(() => {
                                            const extractedServerId = joinInput.split('/').pop()
                                            return address && extractedServerId && serversJoined[address]?.includes(extractedServerId) ? (
                                                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                                                    <p className="text-xs text-yellow-600 flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                                        </div>
                                                        You're already a member of this server
                                                    </p>
                                                </div>
                                            ) : null
                                        })()}
                                    </div>
                                )}

                                {/* Help text */}
                                {!serverDetails && (
                                    <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                                        <h4 className="text-sm font-medium text-foreground mb-2">How to join:</h4>
                                        <ul className="text-xs text-muted-foreground space-y-1">
                                            <li className="flex items-start gap-2">
                                                <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                                                <span>Paste a server ID (exactly 43 characters)</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                                                <span>Paste an invite link from a server member</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                                                <span>Server IDs contain only letters, numbers, hyphens, and underscores</span>
                                            </li>
                                        </ul>

                                        {/* Example server ID */}
                                        <div className="mt-3 pt-3 border-t border-border/30">
                                            <h5 className="text-xs font-medium text-foreground mb-2">Example invites:</h5>
                                            {sampleInvites.map((invite) => (
                                                <button
                                                    key={invite}
                                                    type="button"
                                                    onClick={() => {
                                                        setJoinInput(invite)
                                                        setJoinError("")
                                                    }}
                                                    className={cn(
                                                        "w-full p-3 text-left text-xs font-mono bg-background/50 hover:bg-background/80 border border-border/50 hover:border-blue-400/50 rounded-md transition-all duration-200 group",
                                                        "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                                                    )}
                                                    disabled={isJoining}
                                                >
                                                    <div className="flex flex-row gap-2 w-full h-5 cursor-pointer">
                                                        <span className="text-foreground/80 grow truncate group-hover:text-foreground word-break-all leading-relaxed">
                                                            {invite}
                                                        </span>
                                                        <div className="flex justify-end">
                                                            <div className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                                                join
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>

                        <AlertDialogFooter className="px-4 sm:px-6 pb-6 pt-4 gap-3 flex-shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-sm">
                            <AlertDialogCancel
                                disabled={isJoining}
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <Button
                                onClick={handleJoinServer}
                                disabled={!isValidForSubmission || isJoining}
                                className={cn(
                                    "min-w-[100px] transition-all duration-200",
                                    "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
                                    "shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {isJoining ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Joining...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        <span>Join Server</span>
                                    </div>
                                )}
                            </Button>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            {/* Welcome Popup */}
            {welcomeData && (
                <WelcomePopup
                    isOpen={showWelcomePopup}
                    onClose={hideWelcome}
                    data={welcomeData}
                />
            )}
        </>
    )
} 