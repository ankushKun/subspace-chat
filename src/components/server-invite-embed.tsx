import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Users, Loader2, ExternalLink, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import useSubspace from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import { toast } from "sonner"
import { useWelcomePopup } from "@/hooks/use-welcome-popup"
import WelcomePopup from "@/components/welcome-popup"
import type { Server } from "@/types/subspace"

interface ServerInviteEmbedProps {
    inviteUrl: string
    className?: string
}

export function ServerInviteEmbed({ inviteUrl, className }: ServerInviteEmbedProps) {
    const [serverDetails, setServerDetails] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [isJoining, setIsJoining] = useState(false)

    const { showWelcomePopup, welcomeData, showWelcome, hideWelcome } = useWelcomePopup()
    const subspace = useSubspace()
    const { address } = useWallet()
    const { actions: serverActions, serversJoined } = useServer()

    // Validate if URL is a Subspace invite link
    const isValidSubspaceInvite = (url: string): boolean => {
        if (!url) return false;

        try {
            const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
            const urlObj = new URL(normalizedUrl);

            // Check if it's a subspace.ar.io domain with an invite path
            const isSubspaceDomain = (urlObj.hostname === 'subspace.ar.io' || urlObj.hostname === 'www.subspace.ar.io');
            const hasInviteHash = urlObj.hash.startsWith('#/invite/');

            // console.log('ServerInviteEmbed: Is Subspace domain:', isSubspaceDomain);
            // console.log('ServerInviteEmbed: Has invite hash:', hasInviteHash);

            return isSubspaceDomain && hasInviteHash;
        } catch {
            return false;
        }
    };

    // Extract server ID from invite URL
    const getServerIdFromUrl = (url: string): string => {
        // console.log('ServerInviteEmbed: Extracting server ID from URL:', url);

        if (!url) {
            // console.log('ServerInviteEmbed: URL is empty');
            return "";
        }

        // First validate it's a Subspace invite
        if (!isValidSubspaceInvite(url)) {
            // console.log('ServerInviteEmbed: Not a valid Subspace invite URL');
            return "";
        }

        try {
            const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
            // console.log('ServerInviteEmbed: Normalized URL:', normalizedUrl);

            const urlObj = new URL(normalizedUrl);
            // console.log('ServerInviteEmbed: URL hostname:', urlObj.hostname);
            // console.log('ServerInviteEmbed: URL hash:', urlObj.hash);

            // Extract server ID from hash like #/invite/serverId
            const hashParts = urlObj.hash.substring(1).split('/'); // Remove # and split
            // console.log('ServerInviteEmbed: Hash parts:', hashParts);

            if (hashParts[1] === 'invite' && hashParts[2]) {
                // console.log('ServerInviteEmbed: Extracted server ID:', hashParts[2]);
                return hashParts[2];
            }
        } catch (error) {
            // console.log('ServerInviteEmbed: Error parsing URL:', error);
        }

        // console.log('ServerInviteEmbed: No server ID found');
        return "";
    }

    const serverId = getServerIdFromUrl(inviteUrl)

    // Check if user is already a member
    const isAlreadyMember = address && serversJoined[address]?.includes(serverId)

    // Fetch server details on mount
    useEffect(() => {
        const fetchServerDetails = async () => {
            // console.log('ServerInviteEmbed: Starting fetch for server ID:', serverId);

            if (!serverId) {
                // console.log('ServerInviteEmbed: No server ID provided');
                setError("Invalid invite link")
                setIsLoading(false)
                return
            }

            try {
                setIsLoading(true)
                setError("")

                // console.log('ServerInviteEmbed: Fetching details for server:', serverId);
                const details = await subspace.server.getServerDetails({ serverId })
                // console.log('ServerInviteEmbed: Received server details:', details);

                if (details) {
                    setServerDetails(details)
                } else {
                    // console.log('ServerInviteEmbed: No details returned for server');
                    setError("Server not found")
                }
            } catch (error) {
                console.error("ServerInviteEmbed: Error fetching server details:", error)
                setError("Failed to load server")
            } finally {
                setIsLoading(false)
            }
        }

        fetchServerDetails()
    }, [serverId, subspace.server])

    const handleJoinServer = async () => {
        if (!serverId || !address || !serverDetails) return

        // Check if already a member
        if (isAlreadyMember) {
            toast.info("You're already a member of this server")
            return
        }

        setIsJoining(true)

        try {
            const success = await subspace.user.joinServer({ serverId })

            if (success) {
                // Update local state
                const currentServers = Array.isArray(serversJoined[address]) ? serversJoined[address] : []
                if (!currentServers.includes(serverId)) {
                    serverActions.setServersJoined(address, [...currentServers, serverId])
                }

                // Add server to local state
                const server: Server = {
                    serverId,
                    ...serverDetails
                }
                serverActions.addServer(server)

                // Show welcome popup
                showWelcome({
                    serverId,
                    serverName: serverDetails.name || `Server ${serverId.substring(0, 8)}...`,
                    memberCount: serverDetails.member_count || 0
                })

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
                throw new Error('Failed to join server')
            }
        } catch (error) {
            console.error("Error joining server:", error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes("Already joined server")) {
                toast.info("You're already a member of this server")
            } else {
                toast.error("Failed to join server")
            }
        } finally {
            setIsJoining(false)
        }
    }

    if (isLoading) {
        return (
            <div className={cn(
                "bg-gradient-to-r from-muted/30 to-muted/10 border border-border/50 rounded-lg p-4 my-2 max-w-md",
                className
            )}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded-lg animate-pulse" />
                    <div className="flex-1">
                        <div className="w-32 h-4 bg-muted rounded animate-pulse mb-2" />
                        <div className="w-24 h-3 bg-muted rounded animate-pulse" />
                    </div>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
            </div>
        )
    }

    if (error || !serverDetails) {
        return (
            <div className={cn(
                "bg-gradient-to-r from-red-500/5 to-red-400/5 border border-red-500/20 rounded-lg p-4 my-2 max-w-md",
                className
            )}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                        <ExternalLink className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-foreground">Invalid Invite</h3>
                        <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className={cn(
                "bg-gradient-to-r from-blue-500/5 to-blue-400/5 border border-blue-500/20 rounded-lg p-4 my-2 max-w-md",
                className
            )}>
                <div className="flex items-start gap-3">
                    {/* Server Icon */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
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
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground truncate">
                                    {serverDetails.name || `Server ${serverId.substring(0, 8)}...`}
                                </h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Users className="w-3 h-3" />
                                    <span>{serverDetails.member_count || 0} members</span>
                                    <div className="w-1 h-1 rounded-full bg-green-500" />
                                    <span>Online</span>
                                </div>
                                {serverDetails.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {serverDetails.description}
                                    </p>
                                )}
                            </div>

                            {/* Join Button */}
                            <Button
                                size="sm"
                                onClick={handleJoinServer}
                                disabled={isJoining || isAlreadyMember}
                                className={cn(
                                    "ml-2 min-w-[70px] transition-all duration-200",
                                    isAlreadyMember
                                        ? "bg-green-500 hover:bg-green-500 text-white cursor-default"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                )}
                            >
                                {isJoining ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : isAlreadyMember ? (
                                    <>
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Joined
                                    </>
                                ) : (
                                    "Join"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

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