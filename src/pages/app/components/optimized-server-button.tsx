import { useState, memo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Server } from "@/types/subspace"

interface ServerButtonProps {
    server: Server
    isActive?: boolean
    unreadCount?: number
    onClick?: () => void
}

export const ServerButton = memo(({ server, isActive = false, unreadCount = 0, onClick }: ServerButtonProps) => {
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

                {/* Mention count badge */}
                {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 z-10">
                        <div className={cn(
                            "flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold text-white rounded-full aspect-square",
                            "bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30",
                            "border border-background/20 backdrop-blur-sm",
                            "transition-all duration-200 ease-out",
                            "animate-in zoom-in-50 duration-300"
                        )}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    </div>
                )}

                {/* Tooltip positioned relative to button */}
                <div className={cn(
                    "absolute left-full ml-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none z-[100]",
                    isHovered ? "opacity-100 visible translate-x-0" : "opacity-0 invisible -translate-x-2"
                )}>
                    <div className="bg-popover text-popover-foreground text-sm px-3 py-2 rounded-lg shadow-xl border border-border whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full" />
                            <span className="font-medium">{server.name}</span>
                            {unreadCount > 0 && (
                                <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-red-500/10 text-red-600 rounded text-xs">
                                    <span>{unreadCount}</span>
                                    <span className="text-red-500/70">mention{unreadCount !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                        {/* Arrow pointing left */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[8px] border-transparent border-l-popover" />
                    </div>
                </div>
            </div>
        </div>
    )
})

ServerButton.displayName = "ServerButton" 