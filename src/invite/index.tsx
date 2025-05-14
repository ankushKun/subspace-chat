import { useNavigate, useParams } from 'react-router-dom'
import BackgroundStars from '@/components/background-stars'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import type { Server } from '@/lib/types'
import { getServerInfo, joinServer } from '@/lib/ao'
import { ModeToggle } from '@/components/mode-toggle'
import { FaGear } from 'react-icons/fa6'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function Invite() {
    const { serverId } = useParams()
    const navigate = useNavigate()
    const [serverInfo, setServerInfo] = useState<Server | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [isJoining, setIsJoining] = useState(false)

    async function handleGetServerInfo(serverId: string) {
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await getServerInfo(serverId)
            console.log(response)
            setServerInfo(response as Server)
        } catch (error) {
            setError('Failed to fetch server info')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (!serverId) {
            setError('No server ID provided')
            return
        }

        handleGetServerInfo(serverId)
    }, [serverId])

    async function handlerJoinServer() {
        if (!serverId) {
            setError("No server ID provided")
            return
        }

        setIsJoining(true)
        try {
            await joinServer(serverId!)
            setSuccess("Joined server successfully!")
            toast.success("Joined server successfully!")

            setTimeout(() => {
                navigate(`/app/${serverId}`)
            }, 1000)
        } catch (error) {
            setError("Failed to join server")
            toast.error("Failed to join server")
        } finally {
            setIsJoining(false)
        }
    }

    if (!serverId) {
        return (
            <div className="min-h-screen flex items-center justify-center font-mono">
                <BackgroundStars />
                <ModeToggle className="absolute top-4 right-4" />
                <div className="bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg w-full max-w-md mx-4 shadow-xl overflow-hidden">
                    <div className="p-8 flex flex-col items-center justify-center">
                        <div className="h-20 w-20 rounded-full bg-destructive/20 flex items-center justify-center mb-4 text-3xl font-bold text-destructive">
                            404
                        </div>

                        <h1 className="text-2xl font-bold mb-2 text-center">Invite Not Found</h1>
                        <p className="text-muted-foreground text-center mb-6">Please provide a server ID or invite code to join a server</p>

                        <Button
                            className="w-full py-6 text-lg font-semibold"
                            variant="outline"
                            onClick={() => window.history.back()}
                        >
                            Go Back
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center font-mono">
                <BackgroundStars />
                <ModeToggle className="absolute top-4 right-4" />
                <div className="bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg w-full max-w-md mx-4 shadow-xl overflow-hidden animate-pulse">
                    <div className="p-8 flex flex-col items-center justify-center">
                        {/* Server icon skeleton */}
                        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4"></div>

                        {/* Title skeletons */}
                        <div className="h-3 w-36 bg-muted/50 rounded mb-2"></div>
                        <div className="h-7 w-48 bg-muted/50 rounded mb-6"></div>

                        {/* Member count skeleton */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-4 w-24 bg-muted/50 rounded"></div>
                        </div>

                        {/* Button skeleton */}
                        <div className="w-full h-14 bg-primary/30 rounded"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center font-mono">
                <BackgroundStars />
                <ModeToggle className="absolute top-4 right-4" />
                <div className="bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg w-full max-w-md mx-4 shadow-xl overflow-hidden">
                    <div className="p-8 flex flex-col items-center justify-center">
                        <div className="h-20 w-20 rounded-full bg-destructive/20 flex items-center justify-center mb-4 text-3xl font-bold text-destructive">
                            !
                        </div>

                        <h1 className="text-2xl font-bold mb-2 text-center">Invite Error</h1>
                        <p className="text-muted-foreground text-center mb-6">Failed to fetch server info. Please make sure the server id or invite code is correct or try again later.</p>

                        <Button
                            className="w-full py-6 text-lg font-semibold"
                            variant="outline"
                            onClick={() => handleGetServerInfo(serverId!)}
                        >
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (serverInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center font-mono">
                <BackgroundStars />
                <ModeToggle className="absolute top-4 right-4" />
                <div className="bg-background/80 backdrop-blur-sm border border-border/40 rounded-lg w-full max-w-md mx-4 shadow-xl overflow-hidden">
                    <div className="p-8 flex flex-col items-center justify-center">
                        <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mb-4 overflow-hidden">
                            {serverInfo.icon ? (
                                <img
                                    src={`https://arweave.net/${serverInfo.icon || serverId}`}
                                    alt={serverInfo.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="text-2xl font-bold text-primary">
                                    {serverInfo.name?.charAt(0).toUpperCase() || 'S'}
                                </div>
                            )}
                        </div>

                        <p className="text-muted-foreground text-sm mb-1">You've been invited to join</p>
                        <h1 className="text-3xl font-bold mb-2 text-center">{serverInfo.name || "Unknown Server"}</h1>

                        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                            <div className="flex items-center">
                                <div className="h-2 w-2 rounded-full bg-muted mr-2"></div>
                                <span>{serverInfo.member_count} Members</span>
                            </div>
                        </div>

                        <Button
                            className="w-full py-6 text-lg font-semibold bg-primary hover:bg-primary/90 transition-all"
                            onClick={handlerJoinServer}
                            disabled={isJoining}
                        >
                            {isJoining ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Joining Server...
                                </>
                            ) : (
                                "Accept Invite"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return null;
}