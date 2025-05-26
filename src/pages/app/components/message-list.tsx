import useSubspace, { useMessages, useProfile } from "@/hooks/subspace"
import { useServer } from "@/hooks/subspace/server"
import { useEffect, useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Reply, Edit, Trash2, Pin, Smile, Hash, Send, Plus, Paperclip, Gift, Mic, Bell, BellOff, Users, Search, Inbox, HelpCircle, AtSign } from "lucide-react"
import { cn, shortenAddress } from "@/lib/utils"
import type { Message } from "@/types/subspace"

const ChannelHeader = ({ channelName, channelDescription, memberCount }: {
    channelName?: string;
    channelDescription?: string;
    memberCount?: number;
}) => {
    const [isNotificationMuted, setIsNotificationMuted] = useState(false)

    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm relative z-10">
            {/* Left side - Channel info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <h1 className="text-lg font-semibold text-foreground truncate">
                        {channelName || 'channel'}
                    </h1>
                </div>

                {channelDescription && (
                    <>
                        <div className="w-px h-6 bg-border/50 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                            {channelDescription}
                        </p>
                    </>
                )}
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
                {/* <Button
                    size="sm"
                    variant="ghost"
                    disabled
                    className="h-8 w-8 p-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Pin className="w-4 h-4" />
                </Button> */}

                <div className="w-px h-6 bg-border/50 mx-1" />

                {/* <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Search className="w-4 h-4" />
                </Button> */}

                <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Inbox className="w-4 h-4" />
                </Button>

                <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                    <Users className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

const MessageAvatar = ({ authorId, size = "md" }: { authorId: string; size?: "sm" | "md" | "lg" }) => {
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
                    alt={profile.username || authorId}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-semibold text-sm">
                    {(profile?.username || authorId).charAt(0).toUpperCase()}
                </div>
            )}
        </div>
    )
}

const MessageTimestamp = ({ timestamp }: { timestamp: number }) => {
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
        <span className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            {formatTime(timestamp)}
        </span>
    )
}

const MessageActions = ({ message, onReply, onEdit, onDelete }: {
    message: Message;
    onReply?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}) => {
    return (
        <div className="absolute -top-4 right-4 bg-background border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={onReply}>
                <Reply className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                <Smile className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={onEdit}>
                <Edit className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                <MoreHorizontal className="w-4 h-4" />
            </Button>
        </div>
    )
}

const MessageContent = ({ content, attachments }: { content: string; attachments?: string }) => {
    // Parse attachments if they exist
    const parsedAttachments = useMemo(() => {
        if (!attachments) return []
        try {
            return JSON.parse(attachments)
        } catch {
            return []
        }
    }, [attachments])

    return (
        <div className="space-y-2">
            {/* Message text */}
            {content && (
                <div className="text-sm text-foreground leading-relaxed break-words">
                    {content}
                </div>
            )}

            {/* Attachments */}
            {parsedAttachments.length > 0 && (
                <div className="space-y-2">
                    {parsedAttachments.map((attachment: string, index: number) => (
                        <div key={index} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                            <div className="text-sm text-muted-foreground">
                                Attachment: {attachment}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const MessageItem = ({
    message,
    showAvatar = true,
    isGrouped = false,
    onReply,
    onEdit,
    onDelete
}: {
    message: Message;
    showAvatar?: boolean;
    isGrouped?: boolean;
    onReply?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}) => {
    const { profiles } = useProfile()
    const profile = profiles[message.authorId]
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            className={cn(
                "group relative px-4 py-1 hover:bg-accent/30 transition-colors duration-150",
                isGrouped ? "py-0.5" : "py-2"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex gap-3">
                {/* Avatar or timestamp spacer */}
                <div className="w-10 flex-shrink-0 flex justify-center">
                    {showAvatar ? (
                        <MessageAvatar authorId={message.authorId} />
                    ) : (
                        <MessageTimestamp timestamp={message.timestamp} />
                    )}
                </div>

                {/* Message content */}
                <div className="flex-1 min-w-0">
                    {showAvatar && (
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-foreground hover:underline cursor-pointer">
                                {profile?.username || shortenAddress(message.authorId)}
                            </span>
                            <MessageTimestamp timestamp={message.timestamp} />
                        </div>
                    )}

                    <MessageContent content={message.content} attachments={message.attachments} />
                </div>
            </div>

            {/* Message actions */}
            {isHovered && (
                <MessageActions
                    message={message}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}
        </div>
    )
}

const MessageGroup = ({ messages, onReply, onEdit, onDelete }: {
    messages: Message[];
    onReply?: (message: Message) => void;
    onEdit?: (message: Message) => void;
    onDelete?: (message: Message) => void;
}) => {
    if (messages.length === 0) return null

    return (
        <div className="mb-0.5">
            {messages.map((message, index) => (
                <MessageItem
                    key={message.messageId}
                    message={message}
                    showAvatar={index === 0}
                    isGrouped={index > 0}
                    onReply={() => onReply?.(message)}
                    onEdit={() => onEdit?.(message)}
                    onDelete={() => onDelete?.(message)}
                />
            ))}
        </div>
    )
}

const NoChannelSelected = ({ serverName }: { serverName?: string }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mb-6">
                <Hash className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">
                {serverName ? `Welcome to ${serverName}!` : 'Select a server / DM to start talking'}
            </h3>
            <p className="text-muted-foreground max-w-md leading-relaxed">
                {serverName
                    ? `Select a channel from the sidebar to start viewing and sending messages`
                    : ''
                }
            </p>
            {/* <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground/60">
                <Hash className="w-4 h-4" />
                <span>Pick a channel to get started</span>
            </div> */}
        </div>
    )
}

const EmptyChannelState = ({ channelName }: { channelName?: string }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Hash className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
                Welcome to #{channelName || 'this channel'}!
            </h3>
            <p className="text-muted-foreground max-w-md">
                This is the beginning of the #{channelName || 'channel'} channel.
                Start the conversation by sending a message.
            </p>
        </div>
    )
}

const MessageInput = ({
    onSendMessage,
    replyingTo,
    onCancelReply,
    disabled = false
}: {
    onSendMessage: (content: string, attachments?: string[]) => void;
    replyingTo?: Message | null;
    onCancelReply?: () => void;
    disabled?: boolean;
}) => {
    const [message, setMessage] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const [attachments, setAttachments] = useState<string[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { activeServerId, activeChannelId, servers } = useServer()
    const { profiles } = useProfile()

    // Get current channel info
    const currentChannel = useMemo(() => {
        if (!activeServerId || !activeChannelId) return null
        return servers[activeServerId]?.channels.find(c => c.channelId === activeChannelId)
    }, [servers, activeServerId, activeChannelId])

    const handleSend = () => {
        if (!message.trim() && attachments.length === 0) return

        onSendMessage(message.trim(), attachments)
        setMessage("")
        setAttachments([])
        setIsTyping(false)

        if (replyingTo && onCancelReply) {
            onCancelReply()
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleFileUpload = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        // TODO: Implement file upload to Arweave
        console.log('Files selected:', files)
    }

    const handleTyping = (value: string) => {
        setMessage(value)
        setIsTyping(value.length > 0)
    }

    // Focus input when channel changes
    useEffect(() => {
        if (inputRef.current && !disabled) {
            inputRef.current.focus()
        }
    }, [activeChannelId, disabled])

    if (!currentChannel) {
        return null
    }

    return (
        <div className="relative">
            {/* Reply indicator */}
            {replyingTo && (
                <div className="mx-4 p-3 -mb-4 bg-muted/30 rounded-t-lg border border-border/50 border-b-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <Reply className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Replying to</span>
                            <span className="font-semibold text-foreground">
                                {profiles[replyingTo.authorId]?.username || shortenAddress(replyingTo.authorId)}
                            </span>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={onCancelReply}
                        >
                            <Plus className="w-4 h-4 rotate-45" />
                        </Button>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground truncate">
                        {replyingTo.content.slice(0, 47)}...
                    </div>
                </div>
            )}

            {/* Main input container */}
            <div className="p-4">
                <div className={cn(
                    "relative flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 transition-all duration-200",
                    "hover:border-border focus-within:border-primary/50 focus-within:shadow-lg focus-within:shadow-primary/10",
                    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 focus-within:before:opacity-100 before:transition-opacity before:duration-300 before:rounded-lg",
                    replyingTo && "rounded-t-none border-t-0 before:rounded-t-none"
                )}>
                    {/* Attachment previews */}
                    {attachments.length > 0 && (
                        <div className="p-3 border-b border-border/30">
                            <div className="flex flex-wrap gap-2">
                                {attachments.map((attachment, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
                                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">{attachment}</span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-4 w-4 p-0 hover:bg-muted"
                                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                                        >
                                            <Plus className="w-3 h-3 rotate-45" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input area */}
                    <div className="flex items-center grow gap-3 p-3 relative z-10">
                        {/* Left actions */}
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-muted rounde transition-colors"
                                onClick={handleFileUpload}
                                disabled={disabled}
                            >
                                <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                        </div>

                        {/* Text input */}
                        <div className="flex-1 relative">
                            <Input
                                ref={inputRef}
                                value={message}
                                onChange={(e) => handleTyping(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={`Message #${currentChannel.name}`}
                                disabled={disabled}
                                className={cn(
                                    "border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0",
                                    "placeholder:text-muted-foreground/60 text-sm leading-relaxed",
                                    "min-h-[20px] max-h-[200px] py-2"
                                )}
                            />
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-muted rounded-md transition-colors"
                                disabled={disabled}
                            >
                                <Smile className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </Button>

                            {/* Send button - only show when there's content */}
                            {(message.trim() || attachments.length > 0) && (
                                <Button
                                    size="sm"
                                    className={cn(
                                        "h-8 w-8 p-0 ml-2 transition-all duration-200",
                                        "bg-primary hover:bg-primary/90 text-primary-foreground",
                                        "shadow-lg shadow-primary/20 hover:shadow-primary/30",
                                        "hover:scale-105 active:scale-95"
                                    )}
                                    onClick={handleSend}
                                    disabled={disabled}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                    />
                </div>
            </div>
        </div>
    )
}

export default function MessageList(props: React.HTMLAttributes<HTMLDivElement>) {
    const { messages, actions: messageActions } = useMessages()
    const { activeServerId, activeChannelId, servers } = useServer()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const subspace = useSubspace()
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)

    // Check if no channel is selected
    const hasActiveChannel = activeChannelId && activeChannelId !== 0

    // Get messages for the active channel
    const messagesInChannel = useMemo(() => {
        if (!activeServerId || !hasActiveChannel || !messages[activeServerId]?.[activeChannelId]) {
            return []
        }

        return Object.values(messages[activeServerId][activeChannelId])
            .sort((a, b) => a.timestamp - b.timestamp)
    }, [messages, activeServerId, activeChannelId, hasActiveChannel])

    // Group messages by author and time proximity (within 5 minutes)
    const messageGroups = useMemo(() => {
        const groups: Message[][] = []
        let currentGroup: Message[] = []

        for (const message of messagesInChannel) {
            const lastMessage = currentGroup[currentGroup.length - 1]

            // Start new group if different author or more than 5 minutes apart
            if (!lastMessage ||
                lastMessage.authorId !== message.authorId ||
                message.timestamp - lastMessage.timestamp > 300) {

                if (currentGroup.length > 0) {
                    groups.push(currentGroup)
                }
                currentGroup = [message]
            } else {
                currentGroup.push(message)
            }
        }

        if (currentGroup.length > 0) {
            groups.push(currentGroup)
        }

        return groups
    }, [messagesInChannel])

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messagesInChannel.length])

    // Get current channel info
    const currentChannel = useMemo(() => {
        if (!activeServerId || !hasActiveChannel) return null
        return servers[activeServerId]?.channels.find(c => c.channelId === activeChannelId)
    }, [servers, activeServerId, activeChannelId, hasActiveChannel])

    // Get current server info for member count
    const currentServer = useMemo(() => {
        if (!activeServerId) return null
        return servers[activeServerId]
    }, [servers, activeServerId])

    const handleSendMessage = async (content: string, attachments: string[] = []) => {
        if (!activeServerId || !hasActiveChannel || !content.trim()) return

        try {
            const success = await subspace.server.message.sendMessage({
                serverId: activeServerId,
                channelId: activeChannelId,
                content,
                attachments,
                replyTo: replyingTo?.messageId || undefined
            })

            if (success) {
                // Message will be added via real-time updates
                console.log('Message sent successfully')
            } else {
                console.error('Failed to send message')
            }
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    const handleReply = (message: Message) => {
        setReplyingTo(message)
    }

    const handleCancelReply = () => {
        setReplyingTo(null)
    }

    const handleEdit = (message: Message) => {
        console.log('Edit message:', message)
        // TODO: Implement edit functionality
    }

    const handleDelete = (message: Message) => {
        console.log('Delete message:', message)
        // TODO: Implement delete functionality
    }

    // If no channel is selected, show the no channel state
    if (!hasActiveChannel) {
        return (
            <div
                {...props}
                className={cn(
                    "flex flex-col h-full relative",
                    "bg-gradient-to-b from-background via-background/98 to-background/95",
                    // Subtle pattern overlay
                    "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.01)_0%,transparent_50%)] before:pointer-events-none",
                    props.className
                )}
            >
                {/* Ambient glow at top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-16 bg-primary/3 rounded-full blur-3xl" />

                <NoChannelSelected serverName={currentServer?.name} />

                {/* Ambient glow at bottom */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-primary/2 rounded-full blur-2xl" />
            </div>
        )
    }

    return (
        <div
            {...props}
            className={cn(
                "flex flex-col h-full relative",
                "bg-gradient-to-b from-background via-background/98 to-background/95",
                // Subtle pattern overlay
                "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.01)_0%,transparent_50%)] before:pointer-events-none",
                props.className
            )}
        >
            {/* Ambient glow at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-16 bg-primary/3 rounded-full blur-3xl" />

            {/* Channel Header */}
            <ChannelHeader
                channelName={currentChannel?.name}
                // channelDescription="A place to hangout with intellects and like minded people! 🧠"
                memberCount={currentServer?.member_count}
            />

            {/* Messages container */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
                {messageGroups.length === 0 ? (
                    <EmptyChannelState channelName={currentChannel?.name} />
                ) : (
                    <div className="pt-6">
                        {messageGroups.map((group, index) => (
                            <MessageGroup
                                key={`${group[0].authorId}-${group[0].timestamp}-${index}`}
                                messages={group}
                                onReply={handleReply}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Message input */}
            <MessageInput
                onSendMessage={handleSendMessage}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                disabled={!activeServerId || !hasActiveChannel}
            />
        </div>
    )
}