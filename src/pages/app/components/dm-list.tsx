import { UserPlus } from "lucide-react"

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useState } from "react"
import { cn } from "@/lib/utils";
import UserProfile from "./user-profile";

type DirectMessage = {
    userId: string;
    username: string;
    avatar?: string;
    lastMessage?: string;
    timestamp?: number;
    unreadCount?: number;
    isOnline?: boolean;
}

const DMItem = ({
    dm,
    isActive = false,
    onClick
}: {
    dm: DirectMessage;
    isActive?: boolean;
    onClick?: () => void;
}) => {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="relative group">
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "w-full h-12 px-2 justify-start text-sm transition-all duration-200 relative overflow-hidden",
                    "hover:bg-muted/50 rounded-md",
                    isActive
                        ? "bg-accent/20 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={onClick}
            >
                <div className="flex items-center gap-3 w-full relative z-10">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                            {dm.avatar ? (
                                <img
                                    src={`https://arweave.net/${dm.avatar}`}
                                    alt={dm.username}
                                    className="w-full h-full object-cover rounded-full"
                                />
                            ) : (
                                <span className="text-primary font-semibold text-xs">
                                    {dm.username.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        {/* Online indicator */}
                        {dm.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground truncate">
                                {dm.username}
                            </span>
                            {dm.unreadCount && dm.unreadCount > 0 && (
                                <div className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                                    {dm.unreadCount > 99 ? '99+' : dm.unreadCount}
                                </div>
                            )}
                        </div>
                        {dm.lastMessage && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                                {dm.lastMessage}
                            </p>
                        )}
                    </div>
                </div>

                {/* Subtle shimmer effect on hover */}
                {isHovered && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                )}
            </Button>
        </div>
    )
}

export default function DMList(props: React.HTMLAttributes<HTMLDivElement>) {
    const [searchQuery, setSearchQuery] = useState("")

    // Mock DMs data - replace with real data from your state management
    const mockDMs: DirectMessage[] = [
        {
            userId: "user1",
            username: "Alice",
            lastMessage: "Hey, how's the project going?",
            timestamp: Date.now() - 300000,
            unreadCount: 2,
            isOnline: true
        },
        {
            userId: "user2",
            username: "Bob",
            lastMessage: "Thanks for the help earlier!",
            timestamp: Date.now() - 3600000,
            unreadCount: 0,
            isOnline: false
        },
        {
            userId: "user3",
            username: "Charlie",
            lastMessage: "Let's catch up soon",
            timestamp: Date.now() - 86400000,
            unreadCount: 1,
            isOnline: true
        }
    ]

    const filteredDMs = mockDMs.filter(dm =>
        dm.username.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div {...props}
            className={cn(
                "flex flex-col w-60 h-full relative",
                "bg-gradient-to-b from-background via-background/95 to-background/90",
                "border-r border-border/50 backdrop-blur-sm",
                "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40",
                // Subtle pattern overlay
                "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] before:pointer-events-none",
                props.className
            )}>
            {/* Header */}
            <div className="mb-2 p-4 flex flex-col justify-center items-start relative">
                <div className="flex items-center gap-2 w-full">
                    <MessageCircle className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">
                        Direct Messages
                    </h2>
                </div>
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent absolute bottom-0" />
            </div>

            {/* Search and actions */}
            <div className="px-2 space-y-2">
                <Button
                    disabled
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 px-2 justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                    <Search className="w-4 h-4 mr-2" />
                    Find or start a conversation
                </Button>
            </div>

            {/* Quick actions */}
            <div className="p-2 border-border/30 border-b">
                <Button
                    disabled
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 px-2 justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                </Button>
            </div>

            {/* DMs list */}
            <div className="flex-1 overflow-y-auto space-y-1 px-2">
                {/* {filteredDMs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                        <MessageCircle className="w-8 h-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No conversations yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Start a conversation with someone!
                        </p>
                    </div>
                ) : (
                    filteredDMs.map((dm) => (
                        <DMItem
                            key={dm.userId}
                            dm={dm}
                            isActive={false} // TODO: Implement active DM logic
                            onClick={() => {
                                console.log('Open DM with:', dm.username)
                                // TODO: Implement DM opening logic
                            }}
                        />
                    ))
                )} */}
            </div>


        </div>
    )
}