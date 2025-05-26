import { useProfile, useServer } from "@/hooks/subspace"
import { shortenAddress } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ArioBadge from "./ario-badhe";
import { Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function UserMention({ userId, showAt = true, side = "bottom", align = "center", renderer }:
    { userId: string; showAt?: boolean, side?: "top" | "left" | "bottom" | "right", align?: "start" | "center" | "end", renderer: (text: string) => React.ReactNode }) {
    const { profiles } = useProfile()
    const { activeServerId, servers } = useServer()

    const server = activeServerId ? servers[activeServerId] : null
    const nickname = server ? server?.members.find(m => m.userId === userId)?.nickname! : null

    const profile = profiles[userId]!
    const primaryName = profile?.primaryName || null;

    const displayText = nickname || primaryName || shortenAddress(userId)

    return (
        <Popover>
            <PopoverTrigger asChild>
                {renderer(displayText)}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-md" side={side} align={align}>
                {profile ? (
                    <div className="relative overflow-hidden rounded-md">
                        {/* Header with gradient background */}
                        <div className="h-16 bg-gradient-to-r from-primary/30 via-accent to-primary/30 relative">
                            <div className="absolute inset-0 bg-background/10"></div>
                        </div>

                        {/* Profile content */}
                        <div className="px-4 pb-4 -mt-8 relative">
                            {/* Avatar with border */}
                            <div className="relative mb-3">
                                <img
                                    src={`https://arweave.net/${profile.pfp}`}
                                    alt={profile.primaryName}
                                    className="w-16 h-16 rounded-full border-4 border-card shadow-lg bg-muted"
                                />
                            </div>

                            {/* User info */}
                            <div className="space-y-2">
                                <div>
                                    <h3 className="text-lg font-bold text-card-foreground leading-tight">
                                        {/* {profile.primaryName || nickname || "Unknown User"} */}
                                        {profile.primaryName ? <div className="flex items-center gap-1">
                                            {profile.primaryName}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <ArioBadge className="w-4.5 h-4.5 cursor-pointer" onClick={() => window.open("https://ar.io", "_blank")} />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right">
                                                        This user has a primary name
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div> : <>{nickname || shortenAddress(profile.userId)}</>}
                                    </h3>
                                    {nickname && profile.primaryName && (
                                        <p className="text-sm text-muted-foreground font-medium">
                                            aka {nickname}
                                        </p>
                                    )}
                                </div>

                                <Separator />

                                {/* User details */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            User ID
                                        </span>
                                        <Badge variant="secondary" className="font-mono text-xs !pointer-events-auto">
                                            {shortenAddress(userId)} <Copy id="copy-icon" className="w-3 h-3 z-10 !cursor-pointer !pointer-events-auto" onClick={() => {
                                                navigator.clipboard.writeText(userId)
                                                const copyIcon = document.getElementById("copy-icon")!;
                                                const checkIcon = document.getElementById("check-icon")!;
                                                // hide copy icon and show check icon for 2 seconds
                                                copyIcon.classList.add("hidden");
                                                checkIcon.classList.remove("hidden");
                                                setTimeout(() => {
                                                    copyIcon.classList.remove("hidden");
                                                    checkIcon.classList.add("hidden");
                                                }, 550);
                                            }} />
                                            <Check id="check-icon" className="w-3 h-3 hidden" />
                                        </Badge>
                                    </div>

                                    {server && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                Server Role
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                                {server.owner == userId ? "Owner" : "Member"}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 bg-muted rounded-full mx-auto mb-3 flex items-center justify-center">
                            <span className="text-muted-foreground text-xl">?</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">No profile found</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">This user hasn't set up their profile yet</p>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}