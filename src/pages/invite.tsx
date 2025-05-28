import { useParams, useNavigate } from "react-router"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Users, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import useSubspace from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { useServer } from "@/hooks/subspace/server"
import type { ServerDetailsResponse } from "@/types/subspace"
import LoginDialog from "@/components/login-dialog"
import { updateMetaTags, resetMetaTags } from "@/utils/meta"

export default function Invite() {
    const { invite } = useParams()
    const navigate = useNavigate()
    const subspace = useSubspace()
    const { connected, address } = useWallet()
    const { actions: serverActions, serversJoined } = useServer()

    const [serverInfo, setServerInfo] = useState<ServerDetailsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isJoining, setIsJoining] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasJoined, setHasJoined] = useState(false)

    // Check if user has already joined this server
    const isAlreadyMember = connected && address && invite && serversJoined[address]?.includes(invite)

    useEffect(() => {
        if (!invite) {
            setError("Invalid invite link")
            setIsLoading(false)
            return
        }

        fetchServerInfo()

        // Set initial meta tags for invite
        updateMetaTags({
            title: `Join Server - Subspace`,
            description: `You've been invited to join a server on Subspace, the intergalactic communication app built on the Permaweb.`,
            url: window.location.href,
            type: 'website',
            siteName: 'Subspace',
            image: `${window.location.origin}/invite-og-default.svg`,
            imageAlt: 'Subspace Server Invite',
            imageWidth: '1200',
            imageHeight: '630'
        })

        // Cleanup function to reset meta tags when component unmounts
        return () => {
            resetMetaTags()
        }
    }, [invite])

    // Update meta tags when server info is loaded
    useEffect(() => {
        if (serverInfo && invite) {
            const serverName = serverInfo.name || `Server ${invite.substring(0, 8)}...`
            const memberText = serverInfo.member_count === 1 ? 'member' : 'members'
            const serverImage = serverInfo.icon
                ? `https://arweave.net/${serverInfo.icon}`
                : `${window.location.origin}/invite-og-default.svg`

            updateMetaTags({
                title: `Join ${serverName} - Subspace`,
                description: `You've been invited to join "${serverName}" on Subspace. ${serverInfo.member_count} ${memberText} • Decentralized communication on the Permaweb`,
                image: serverImage,
                url: window.location.href,
                type: 'website',
                siteName: 'Subspace',
                imageAlt: `${serverName} server on Subspace`,
                imageWidth: serverInfo.icon ? '400' : '1200',
                imageHeight: serverInfo.icon ? '400' : '630'
            })
        }
    }, [serverInfo, invite])

    const fetchServerInfo = async () => {
        if (!invite) return

        setIsLoading(true)
        setError(null)

        try {
            const details = await subspace.server.getServerDetails({ serverId: invite })
            if (details) {
                setServerInfo(details)
            } else {
                setError("Server not found or invite is invalid")
            }
        } catch (error) {
            console.error("Error fetching server info:", error)
            setError("Failed to load server information")
        } finally {
            setIsLoading(false)
        }
    }

    const handleJoinServer = async () => {
        if (!invite || !connected || !address) return

        setIsJoining(true)
        try {
            const success = await subspace.user.joinServer({ serverId: invite })

            if (success) {
                // Update local state
                const currentServers = serversJoined[address] || []
                if (!currentServers.includes(invite)) {
                    serverActions.setServersJoined(address, [...currentServers, invite])
                }

                // Add server to cache if we have the details
                if (serverInfo) {
                    serverActions.addServer({
                        serverId: invite,
                        ...serverInfo
                    })
                }

                setHasJoined(true)
                toast.success("Successfully joined the server!")

                // Navigate to the server after a short delay
                setTimeout(() => {
                    const serverName = serverInfo?.name || `Server ${invite.substring(0, 8)}...`
                    const memberCount = serverInfo?.member_count || 0

                    // Navigate with URL parameters for the welcome popup
                    navigate(`/app?welcome=true&serverId=${invite}&serverName=${encodeURIComponent(serverName)}&memberCount=${memberCount}`)
                    serverActions.setActiveServerId(invite)
                }, 1500)
            } else {
                toast.error("Failed to join server")
            }
        } catch (error) {
            console.error("Error joining server:", error)
            toast.error("Failed to join server")
        } finally {
            setIsJoining(false)
        }
    }

    const getDisplayName = () => {
        if (serverInfo?.name) return serverInfo.name
        if (invite) return `Server ${invite.substring(0, 8)}...`
        return "Unknown Server"
    }

    const getServerIcon = () => {
        if (serverInfo?.icon) {
            return `https://arweave.net/${serverInfo.icon}`
        }
        return null
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/90 relative overflow-hidden p-4">
            <title>{serverInfo ? `Join ${getDisplayName()} - Subspace` : 'Join Server - Subspace'}</title>

            {/* Background decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)] pointer-events-none" />

            {/* Back button */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="absolute top-6 left-6 text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
            </Button>

            {/* Main content */}
            <div className="w-full max-w-md mx-auto relative z-10">
                <div className="bg-background/80 backdrop-blur-sm border border-border/40 rounded-2xl shadow-xl overflow-hidden">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="p-8 flex flex-col items-center justify-center space-y-6">
                            <div className="w-20 h-20 rounded-2xl bg-muted/50 animate-pulse" />
                            <div className="space-y-3 text-center">
                                <div className="h-4 w-32 bg-muted/50 rounded animate-pulse mx-auto" />
                                <div className="h-6 w-48 bg-muted/50 rounded animate-pulse mx-auto" />
                            </div>
                            <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                            <div className="w-full h-12 bg-muted/50 rounded-xl animate-pulse" />
                        </div>
                    )}

                    {/* Error State */}
                    {error && !isLoading && (
                        <div className="p-8 flex flex-col items-center justify-center space-y-6">
                            <div className="w-20 h-20 rounded-2xl bg-destructive/20 flex items-center justify-center">
                                <AlertCircle className="w-10 h-10 text-destructive" />
                            </div>
                            <div className="space-y-2 text-center">
                                <h2 className="text-xl font-semibold text-foreground">Invite Invalid</h2>
                                <p className="text-muted-foreground">{error}</p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={fetchServerInfo}
                                className="w-full"
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {/* Success State */}
                    {serverInfo && !isLoading && !error && (
                        <div className="p-8 flex flex-col items-center justify-center space-y-6">
                            {/* Server Icon */}
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                                    {getServerIcon() ? (
                                        <img
                                            src={getServerIcon()!}
                                            alt={getDisplayName()}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-2xl font-bold text-primary">
                                            {getDisplayName().charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                {hasJoined && (
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-background">
                                        <CheckCircle className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Server Info */}
                            <div className="space-y-2 text-center">
                                <p className="text-sm text-muted-foreground">
                                    {hasJoined ? "Welcome to" : "You've been invited to join"}
                                </p>
                                <h1 className="text-2xl font-bold text-foreground">
                                    {getDisplayName()}
                                </h1>
                            </div>

                            {/* Member Count */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>
                                    {serverInfo.member_count} {serverInfo.member_count === 1 ? 'member' : 'members'}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-green-500" />
                                <span>Online</span>
                            </div>

                            {/* Action Button */}
                            <div className="w-full space-y-3">
                                {!connected ? (
                                    <LoginDialog>
                                        <Button className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary">
                                            Connect Wallet to Join
                                        </Button>
                                    </LoginDialog>
                                ) : hasJoined ? (
                                    <Button
                                        onClick={() => {
                                            const serverName = serverInfo?.name || `Server ${invite.substring(0, 8)}...`
                                            const memberCount = serverInfo?.member_count || 0
                                            navigate(`/app?welcome=true&serverId=${invite}&serverName=${encodeURIComponent(serverName)}&memberCount=${memberCount}`)
                                            serverActions.setActiveServerId(invite!)
                                        }}
                                        className="w-full h-12 text-base font-medium bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white"
                                    >
                                        Go to Server
                                    </Button>
                                ) : isAlreadyMember ? (
                                    <Button
                                        onClick={() => {
                                            navigate(`/app`)
                                            serverActions.setActiveServerId(invite!)
                                        }}
                                        variant="outline"
                                        className="w-full h-12 text-base font-medium"
                                    >
                                        Go to Server
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleJoinServer}
                                        disabled={isJoining}
                                        className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                                    >
                                        {isJoining ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Joining...
                                            </>
                                        ) : (
                                            "Accept Invite"
                                        )}
                                    </Button>
                                )}

                                {isAlreadyMember && !hasJoined && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        You're already a member of this server
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                {!isLoading && !error && (
                    <p className="text-xs text-muted-foreground/70 text-center mt-6">
                        Invites never expire and can be used by anyone
                    </p>
                )}
            </div>
        </div>
    )
}