import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { ArrowLeft, AlertCircle, Users, Shield, Zap, CheckCircle, Loader2 } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import useSubspace from "@/hooks/subspace"
import { useServer } from "@/hooks/subspace/server"
import type { ServerDetailsResponse } from "@/types/subspace"
import { toast } from "sonner"
import LoginDialog from "@/components/login-dialog"

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
    const isAlreadyMember = connected && address && invite && Array.isArray(serversJoined[address]) && serversJoined[address].includes(invite)

    // Function to update meta tags dynamically
    const updateMetaTags = (serverInfo: ServerDetailsResponse | null) => {
        const title = serverInfo
            ? `Join ${serverInfo.name} - Subspace`
            : 'Join Server - Subspace'

        const description = serverInfo
            ? `You've been invited to join ${serverInfo.name} on Subspace. ${serverInfo.member_count} ${serverInfo.member_count === 1 ? 'member' : 'members'} are already chatting!`
            : 'You\'ve been invited to join a server on Subspace - a communication app built on a permanent, censorship resistant network.'

        const imageUrl = serverInfo?.icon
            ? `https://arweave.net/${serverInfo.icon}`
            : 'https://subspace.ar.io/s.png'

        // Update document title
        document.title = title

        // Update or create meta tags
        const updateMetaTag = (property: string, content: string) => {
            let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
            if (!meta) {
                meta = document.createElement('meta')
                meta.setAttribute('property', property)
                document.head.appendChild(meta)
            }
            meta.setAttribute('content', content)
        }

        const updateMetaTagName = (name: string, content: string) => {
            let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
            if (!meta) {
                meta = document.createElement('meta')
                meta.setAttribute('name', name)
                document.head.appendChild(meta)
            }
            meta.setAttribute('content', content)
        }

        // Update OpenGraph tags
        updateMetaTag('og:title', title)
        updateMetaTag('og:description', description)
        updateMetaTag('og:image', imageUrl)
        updateMetaTag('og:url', window.location.href)

        // Update Twitter tags
        updateMetaTagName('twitter:title', title)
        updateMetaTagName('twitter:description', description)
        updateMetaTagName('twitter:image', imageUrl)

        // Update standard meta description
        updateMetaTagName('description', description)
    }

    useEffect(() => {
        if (!invite) {
            setError("Invalid invite link")
            setIsLoading(false)
            return
        }

        fetchServerInfo()
    }, [invite])

    useEffect(() => {
        // Update meta tags when server info changes
        updateMetaTags(serverInfo)
    }, [serverInfo])

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
                const currentServers = Array.isArray(serversJoined[address]) ? serversJoined[address] : []
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
            {/* Default meta tags - will be updated dynamically when server info loads */}
            <title>You've been invited to join a server - Subspace</title>
            <meta name="description" content="You've been invited to join a server on Subspace - a communication app built on a permanent, censorship resistant network." />
            <meta property="og:title" content="You've been invited to join a server - Subspace" />
            <meta property="og:description" content="You've been invited to join a server on Subspace - a communication app built on a permanent, censorship resistant network." />
            <meta property="og:image" content="https://subspace.ar.io/s.png" />
            <meta property="og:url" content={window.location.href} />
            <meta name="twitter:title" content="You've been invited to join a server - Subspace" />
            <meta name="twitter:description" content="You've been invited to join a server on Subspace - a communication app built on a permanent, censorship resistant network." />
            <meta name="twitter:image" content="https://subspace.ar.io/s.png" />

            {/* Background decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)] pointer-events-none" />

            {/* Back button */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/app")}
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