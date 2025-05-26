import { useServer } from "@/hooks/subspace/server"
import { useState } from "react"
import useSubspace, { useProfile } from "@/hooks/subspace"
import { useWallet } from "@/hooks/use-wallet"
import { type Server } from "@/types/subspace"
import { Button } from "@/components/ui/button"
import { Download, Home, Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const ServerButton = ({ server, isActive = false, onClick }: { server: Server; isActive?: boolean, onClick?: () => void }) => {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group mb-3">
            {/* Glow effect for active state */}
            {isActive && (
                <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl scale-110 animate-pulse" />
            )}

            {/* Active/Hover indicator pill with glow */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isActive
                        ? "h-10 bg-gradient-to-b from-primary via-primary to-primary/80 shadow-lg shadow-primary/50"
                        : isHovered
                            ? "h-6 bg-gradient-to-b from-foreground/80 to-foreground/60 shadow-md shadow-foreground/30"
                            : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        isActive ? "rounded-2xl shadow-lg shadow-primary/20" : "rounded-3xl hover:rounded-2xl hover:shadow-md hover:shadow-foreground/10"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={onClick}
                >
                    <div className={cn(
                        "w-12 h-12 overflow-hidden transition-all duration-300 ease-out relative",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:via-transparent before:to-transparent before:opacity-0 group-hover:before:opacity-100 before:transition-opacity before:duration-300",
                        isActive ? "rounded-2xl" : "rounded-xl group-hover:rounded-2xl"
                    )}>
                        <img
                            src={`https://arweave.net/${server.icon}`}
                            alt={server.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                    </div>
                </Button>

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full" />
                            <span className="font-medium">{server.name}</span>
                        </div>
                        {/* Arrow pointing left */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
}

const HomeButton = ({ isActive = false, onClick }: { isActive?: boolean, onClick?: () => void }) => {
    const [isHovered, setIsHovered] = useState(false)
    const actions = useServer(state => state.actions)

    return (
        <div className="relative group mb-3">
            {/* Glow effect for active state */}
            {isActive && (
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl scale-110 animate-pulse" />
            )}

            {/* Active/Hover indicator pill with glow */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isActive
                        ? "h-10 bg-gradient-to-b from-primary via-primary to-primary/80 shadow-lg shadow-primary/50"
                        : isHovered
                            ? "h-6 bg-gradient-to-b from-foreground/80 to-foreground/60 shadow-md shadow-foreground/30"
                            : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        isActive
                            ? "rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30"
                            : "rounded-3xl hover:rounded-2xl bg-muted/50 hover:bg-gradient-to-br hover:from-primary hover:to-primary/80 hover:shadow-md hover:shadow-primary/20"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={onClick}
                >
                    <Home className={cn(
                        "w-5 h-5 transition-all duration-300",
                        isActive
                            ? "text-primary-foreground drop-shadow-sm"
                            : "text-muted-foreground group-hover:text-primary-foreground group-hover:scale-110"
                    )} />
                    {/* Sparkle effect for active state */}
                    {/* {isActive && (
                        <Sparkles className="absolute top-1 right-1 w-3 h-3 text-primary-foreground/60 animate-pulse" />
                    )} */}
                </Button>

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <Home className="w-3 h-3 text-primary" />
                            <span className="font-medium">Home</span>
                        </div>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
}

const AddServerButton = () => {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group mb-3">
            {/* Hover indicator pill */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isHovered
                        ? "h-6 bg-gradient-to-b from-green-500/80 to-green-400/60 shadow-md shadow-green-500/30"
                        : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        "rounded-3xl hover:rounded-2xl bg-muted/30 hover:bg-gradient-to-br hover:from-green-500 hover:to-green-400 hover:shadow-md hover:shadow-green-500/20",
                        "border-2 border-dashed border-muted-foreground/30 hover:border-green-400/50"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <Plus className={cn(
                        "w-5 h-5 transition-all duration-300",
                        "text-muted-foreground group-hover:text-white group-hover:scale-110 group-hover:rotate-90"
                    )} />

                    {/* Shimmer effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                </Button>

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <Plus className="w-3 h-3 text-green-500" />
                            <span className="font-medium">Add Server</span>
                        </div>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
}

const InstallPWAButton = () => {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group mb-3">
            {/* Hover indicator pill */}
            <div
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all duration-300 ease-out",
                    isHovered
                        ? "h-6 bg-gradient-to-b from-primary/80 to-primary/60 shadow-md shadow-primary/30"
                        : "h-0"
                )}
            />

            <div className="flex justify-center relative">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-300 ease-out hover:bg-transparent group relative overflow-hidden",
                        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-background/10 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
                        "rounded-3xl hover:rounded-2xl bg-muted/30 hover:bg-gradient-to-br hover:from-primary hover:to-primary/80 hover:shadow-md hover:shadow-primary/20"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <Download className={cn(
                        "w-5 h-5 transition-all duration-300",
                        "text-muted-foreground group-hover:text-primary-foreground group-hover:scale-110 group-hover:-translate-y-0.5"
                    )} />

                    {/* Shimmer effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                </Button>

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <Download className="w-3 h-3 text-primary" />
                            <span className="font-medium">Install App</span>
                        </div>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function ServerList(props: React.HTMLAttributes<HTMLDivElement>) {
    const { address } = useWallet()
    const { servers, actions, activeServerId, serversJoined } = useServer()

    return (
        <div
            {...props}
            className={cn(
                "flex flex-col w-[72px] h-full py-4 px-3 relative z-10",
                "bg-gradient-to-b from-background via-background/95 to-background/90",
                "border-r border-border/50 backdrop-blur-sm",
                "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40",
                // Subtle pattern overlay
                "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] before:pointer-events-none"
            )}
        >
            {/* Ambient glow at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />

            {/* Home Button */}
            <HomeButton isActive={activeServerId === null} onClick={() => { actions.setActiveServerId(null); actions.setActiveChannelId(null) }} />

            {/* Enhanced Separator with gradient */}
            <div className="relative mx-auto mb-3">
                <div className="w-8 h-[2px] bg-gradient-to-r from-transparent via-border to-transparent rounded-full" />
                <div className="absolute inset-0 w-8 h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-full blur-sm" />
            </div>

            {/* Server Buttons */}
            <div className="space-y-1 overflow-visible">
                {/* {Object.values(servers).filter((server) => serversJoined[server.serverId]).map((server, index) => (
                    <div
                        key={server.serverId}
                        style={{ animationDelay: `${index * 100}ms` }}
                        className="animate-in slide-in-from-left-5 fade-in duration-500"
                    >
                        <ServerButton server={server} isActive={server.serverId === activeServerId} onClick={() => actions.setActiveServerId(server.serverId)} />
                    </div>
                ))} */}
                {
                    serversJoined
                    && serversJoined[address]
                    && serversJoined[address].length > 0
                    && serversJoined[address].map((serverId, index) => (
                        servers[serverId] && (
                            <div
                                key={serverId}
                                style={{ animationDelay: `${index * 100}ms` }}
                                className="animate-in slide-in-from-left-5 fade-in duration-500"
                            >
                                <ServerButton server={servers[serverId]} isActive={serverId === activeServerId} onClick={() => actions.setActiveServerId(serverId)} />
                            </div>
                        )
                    ))
                }
            </div>

            <div className="grow" />

            <InstallPWAButton />
            <AddServerButton />

            {/* Ambient glow at bottom */}
            <div className="absolute bottom-4 left-1 /2 -translate-x-1/2 w-12 h-12 bg-primary/3 rounded-full blur-xl" />
        </div>
    )
}