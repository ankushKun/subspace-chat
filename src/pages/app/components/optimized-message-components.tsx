import { memo, type HTMLAttributes } from "react"
import { cn, shortenAddress } from "@/lib/utils"
import { useProfile } from "@/hooks/subspace"
import type { Message } from "@/types/subspace"

interface MessageAvatarProps {
    authorId: string
    size?: "sm" | "md" | "lg"
}

export const MessageAvatar = memo(({ authorId, size = "md" }: MessageAvatarProps) => {
    const { profiles } = useProfile()
    const profile = profiles[authorId]

    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-10 h-10",
        lg: "w-12 h-12"
    }

    return (
        <div className={cn(
            "relative rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0",
            sizeClasses[size]
        )}>
            {profile?.pfp ? (
                <img
                    src={`https://arweave.net/${profile.pfp}`}
                    alt={authorId}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-semibold text-sm">
                    {(profile?.primaryName || authorId).charAt(0).toUpperCase()}
                </div>
            )}
        </div>
    )
})

MessageAvatar.displayName = "MessageAvatar"

interface MessageTimestampProps extends HTMLAttributes<HTMLSpanElement> {
    timestamp: number
}

export const MessageTimestamp = memo(({ timestamp, className, ...props }: MessageTimestampProps) => {
    const formatTime = (ts: number) => {
        const date = new Date(ts)
        const now = new Date()

        // Get start of today and yesterday for comparison
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

        if (messageDate.getTime() === today.getTime()) {
            // Same day - show relative time
            const diffMs = now.getTime() - date.getTime()
            const diffMinutes = Math.floor(diffMs / (1000 * 60))
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

            if (diffMinutes < 1) {
                return 'just now'
            } else if (diffMinutes < 60) {
                return `${diffMinutes}m ago`
            } else if (diffHours < 24) {
                return `${diffHours}h ago`
            } else {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        } else if (messageDate.getTime() === yesterday.getTime()) {
            // Yesterday
            return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        } else {
            // Older - show short date and time
            return date.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        }
    }

    return (
        <span className={cn("text-muted-foreground/60 hover:text-muted-foreground transition-colors", className)} {...props}>
            {formatTime(timestamp)}
        </span>
    )
})

MessageTimestamp.displayName = "MessageTimestamp"

interface DateDividerProps {
    timestamp: number
}

export const DateDivider = memo(({ timestamp }: DateDividerProps) => {
    const formatDate = (ts: number) => {
        const date = new Date(ts)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

        if (messageDate.getTime() === today.getTime()) {
            return 'Today'
        } else if (messageDate.getTime() === yesterday.getTime()) {
            return 'Yesterday'
        } else {
            return date.toLocaleDateString([], {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        }
    }

    return (
        <div className="flex items-center my-6 px-4">
            <div className="flex-1 h-px bg-border/50" />
            <div className="px-4 text-xs font-medium text-muted-foreground bg-background">
                {formatDate(timestamp)}
            </div>
            <div className="flex-1 h-px bg-border/50" />
        </div>
    )
})

DateDivider.displayName = "DateDivider"

interface EmptyChannelStateProps {
    channelName?: string
}

export const EmptyChannelState = memo(({ channelName }: EmptyChannelStateProps) => {
    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    Welcome to #{channelName || 'channel'}!
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                    This is the beginning of the #{channelName || 'channel'} channel. Start the conversation!
                </p>
            </div>
        </div>
    )
})

EmptyChannelState.displayName = "EmptyChannelState" 