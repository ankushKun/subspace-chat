import useSubspace, { useMessages, useProfile } from "@/hooks/subspace"
import { useServer } from "@/hooks/subspace/server"
import React, { useEffect, useState, useMemo, useRef, type HTMLAttributes } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Reply, Edit, Trash2, Pin, Smile, Hash, Send, Plus, Paperclip, Gift, Mic, Bell, BellOff, Users, Search, Inbox, HelpCircle, AtSign, Loader2, CornerDownRight, CornerDownLeft, CornerLeftDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, shortenAddress } from "@/lib/utils"
import type { Message } from "@/types/subspace"
import { Mention, MentionsInput } from "react-mentions"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeKatex from "rehype-katex"
import { mdComponents, setCurrentMentions, JoinServerDialogContext } from "@/lib/md-components"
import UserMention from "@/components/user-mention"
import { useWallet } from "@/hooks/use-wallet"
import { toast } from "sonner"
import InboxComponent from "@/components/inbox"
import NoChannel from "./no-channel"
import { useIsMobile, useIsMobileDevice } from "@/hooks/use-mobile"
import { JoinServerDialog } from "@/components/join-server-dialog"

const ChannelHeader = ({ channelName, channelDescription, memberCount, onToggleMemberList, showMemberList }: {
    channelName?: string;
    channelDescription?: string;
    memberCount?: number;
    onToggleMemberList?: () => void;
    showMemberList?: boolean;
}) => {
    const [isNotificationMuted, setIsNotificationMuted] = useState(false)
    const { activeServerId } = useServer()
    const isMobile = useIsMobile()

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

                {/* <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Inbox className="w-4 h-4" />
                </Button> */}

                <InboxComponent className="h-8 w-8 p-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" />

                {!isMobile && activeServerId && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onToggleMemberList}
                        className={cn(
                            "h-8 w-8 p-0 hover:bg-muted/50 transition-colors",
                            showMemberList
                                ? "text-primary hover:text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        title={showMemberList ? "Hide member list" : "Show member list"}
                    >
                        <Users className="w-4 h-4" />
                    </Button>
                )}
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
    const { address } = useWallet()
    const { activeServerId, servers } = useServer()

    // Check if current user can edit (only message author)
    const canEdit = message.authorId === address

    // Check if current user can delete (message author OR server owner)
    const currentServer = activeServerId ? servers[activeServerId] : null
    const isServerOwner = currentServer?.owner === address
    const canDelete = message.authorId === address || isServerOwner

    return (
        <div className="absolute -top-4 right-4 bg-background border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={onReply}>
                <Reply className="w-4 h-4" />
            </Button>
            {/* <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                <Smile className="w-4 h-4" />
            </Button> */}
            {canEdit && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={onEdit}>
                    <Edit className="w-4 h-4" />
                </Button>
            )}
            {canDelete && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-muted text-destructive hover:text-destructive"
                    onClick={onDelete}
                    title={isServerOwner && message.authorId !== address ? "Delete as server owner" : "Delete message"}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
            {/* <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                <MoreHorizontal className="w-4 h-4" />
            </Button> */}
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

    function preProcessContent(content: string) {
        // Process mentions similar to legacy implementation
        const mentions: { type: 'user' | 'channel'; display: string; id: string; }[] = [];
        let processedContent = content;

        // Extract and store user mentions: @[Display Name](userId)
        const userMentionRegex = /@\[([^\]]+)\]\(([A-Za-z0-9_-]+)\)/g;
        processedContent = processedContent.replace(userMentionRegex, (match, display, id) => {
            const index = mentions.length;
            mentions.push({ type: 'user', display, id });
            return `[${display}](#__user_mention_${index}__)`;
        });

        // Extract and store channel mentions: #[Display Name](channelId)
        const channelMentionRegex = /#\[([^\]]+)\]\(([0-9]+)\)/g;
        processedContent = processedContent.replace(channelMentionRegex, (match, display, id) => {
            const index = mentions.length;
            mentions.push({ type: 'channel', display, id });
            return `[${display}](#__channel_mention_${index}__)`;
        });

        // Also handle the expected format for backward compatibility
        const expectedMentionRegex = /<@([A-Za-z0-9_-]+)>/g;
        const expectedChannelRegex = /<#([0-9]+)>/g;

        processedContent = processedContent.replace(expectedMentionRegex, (match, id) => {
            const index = mentions.length;
            mentions.push({ type: 'user', display: id, id });
            return `[${id}](#__user_mention_${index}__)`;
        });

        processedContent = processedContent.replace(expectedChannelRegex, (match, id) => {
            const index = mentions.length;
            mentions.push({ type: 'channel', display: id, id });
            return `[${id}](#__channel_mention_${index}__)`;
        });

        // Set mentions data for the markdown components to access
        setCurrentMentions(mentions);

        return processedContent;
    }

    return (
        <div className="space-y-">
            {/* Message text */}
            {content && (
                <div className="text-sm text-foreground leading-relaxed break-words markdown">
                    <Markdown skipHtml
                        components={mdComponents}
                        remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]} disallowedElements={["img"]}>
                        {preProcessContent(content)}
                    </Markdown>
                </div>
            )}

            {/* Attachments */}
            {parsedAttachments.length > 0 && (
                <div className="space-y-">
                    {parsedAttachments.map((attachment: string, index: number) => (
                        <div key={index} className="bg-muted/30 rounded-lg p- border border-border/50">
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

const ReplyPreview = ({ replyToId, messages, onJumpToMessage, ...props }: HTMLAttributes<HTMLDivElement> & {
    replyToId: number;
    messages: Record<number, Message>;
    onJumpToMessage?: (messageId: number) => void;
}) => {
    const { profiles } = useProfile()

    // Find the original message
    const originalMessage = messages[replyToId]

    if (!originalMessage) {
        return (
            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground/60">
                <CornerLeftDown className="w-3 h-3" />
                <span className="italic">Original message not found</span>
            </div>
        )
    }

    const authorProfile = profiles[originalMessage.authorId]
    const displayName = authorProfile?.primaryName || shortenAddress(originalMessage.authorId)

    // Truncate content for preview
    const previewContent = originalMessage.content.length > 50
        ? originalMessage.content.substring(0, 50) + "..."
        : originalMessage.content

    return (
        <div
            {...props}
            className={cn("flex items-start gap-2 border-muted-foreground/30 hover:border-primary/50 transition-all duration-200 cursor-pointer rounded-r-md hover:bg-muted/30 py-1.5 -my-1 group/reply", props.className)}
            onClick={() => onJumpToMessage?.(replyToId)}
            title="Click to jump to original message"
        >
            <CornerLeftDown className="w-3 h-3 text-muted-foreground/50 group-hover/reply:text-primary/70 mt-0.5 flex-shrink-0 transition-colors" />
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Small avatar */}
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0 flex items-center justify-center overflow-hidden border border-border/20">
                    {authorProfile?.pfp ? (
                        <img
                            src={`https://arweave.net/${authorProfile.pfp}`}
                            alt={displayName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-[8px] font-semibold text-primary">
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>

                {/* Author name and content preview */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <UserMention
                        side="top"
                        align="start"
                        userId={originalMessage.authorId}
                        renderer={(text) => (
                            <span className="text-xs font-medium text-foreground/70 group-hover/reply:text-primary flex-shrink-0 hover:underline">
                                {text}
                            </span>
                        )}
                    />
                    {/* <span className="text-xs text-muted-foreground/80 group-hover/reply:text-muted-foreground truncate">
                        {displayName}
                    </span> */}
                    <span className="text-xs text-muted-foreground/60 group-hover/reply:text-muted-foreground truncate">
                        {previewContent}
                    </span>
                </div>
            </div>
        </div>
    )
}

const MessageItem = ({
    message,
    showAvatar = true,
    isGrouped = false,
    onReply,
    onEdit,
    onDelete,
    isEditing = false,
    editedContent = "",
    onEditContentChange,
    onSaveEdit,
    onCancelEdit,
    isSavingEdit = false,
    allMessages = {},
    onJumpToMessage
}: {
    message: Message;
    showAvatar?: boolean;
    isGrouped?: boolean;
    onReply?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    isEditing?: boolean;
    editedContent?: string;
    onEditContentChange?: (content: string) => void;
    onSaveEdit?: () => void;
    onCancelEdit?: () => void;
    isSavingEdit?: boolean;
    allMessages?: Record<number, Message>;
    onJumpToMessage?: (messageId: number) => void;
}) => {
    const { profiles } = useProfile()
    const { address } = useWallet()
    const profile = profiles[message.authorId]
    const [isHovered, setIsHovered] = useState(false)

    // Check if the current user is mentioned in this message
    const isCurrentUserMentioned = useMemo(() => {
        if (!address || !message.content) return false

        // Check for mentions in the format @[Display Name](userId) where userId matches current address
        const userMentionRegex = /@\[([^\]]+)\]\(([A-Za-z0-9_-]+)\)/g
        const expectedMentionRegex = /<@([A-Za-z0-9_-]+)>/g

        let match
        // Check @[Display Name](userId) format
        while ((match = userMentionRegex.exec(message.content)) !== null) {
            if (match[2] === address) return true
        }

        // Check <@userId> format for backward compatibility
        while ((match = expectedMentionRegex.exec(message.content)) !== null) {
            if (match[1] === address) return true
        }

        return false
    }, [message.content, address])

    return (
        <div
            className={cn(
                "group relative hover:bg-accent/30 transition-colors duration-150",
                isGrouped ? "py-0.5" : "pt-2 pb-1",
                isCurrentUserMentioned && "bg-yellow-400/8 hover:bg-yellow-400/12 border-l-2 border-yellow-500/70 pl-2 -ml-2"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Reply preview - show if this message is a reply */}
            {message.replyTo && (
                <div className="relative left-7 h-6">
                    <ReplyPreview
                        replyToId={message.replyTo}
                        messages={allMessages}
                        onJumpToMessage={onJumpToMessage}
                    />
                </div>
            )}
            <div className="flex gap-1">
                {/* Avatar or timestamp spacer */}
                <UserMention side="right" align="start" userId={message.authorId} renderer={() => <div className="w-16 flex-shrink-0 flex justify-center cursor-pointer">
                    {showAvatar || message.replyTo ? (
                        <MessageAvatar authorId={message.authorId} />
                    ) : (
                        <div className="opacity-0 hover:opacity-100 transition-opacity duration-150 !text-xs text-center">
                            <MessageTimestamp timestamp={message.timestamp} />
                        </div>
                    )}
                </div>} />

                {/* Message content */}
                <div className="flex-1 min-w-0 m-0 my-1 p-0">
                    {showAvatar && (
                        <div className="flex items-baseline gap-2">
                            <UserMention side="bottom" align="start" userId={message.authorId} renderer={(text) =>
                                <span className="text-foreground hover:underline cursor-pointer">
                                    {text}
                                </span>
                            } />
                            <MessageTimestamp timestamp={message.timestamp} />
                            {message.edited === 1 && (
                                <span className="text-xs text-muted-foreground/80 italic" title="This message has been edited">
                                    (edited)
                                </span>
                            )}
                        </div>
                    )}


                    {/* Show edit input if editing this message */}
                    {isEditing ? (
                        <div className="mt-1">
                            <div className="flex gap-2 mt-2">
                                <Input
                                    type="text"
                                    value={editedContent}
                                    onChange={(e) => onEditContentChange?.(e.target.value)}
                                    className="w-full p-2 text-sm bg-muted/50 rounded-md"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            onSaveEdit?.()
                                        } else if (e.key === 'Escape') {
                                            onCancelEdit?.()
                                        }
                                    }}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onSaveEdit}
                                    disabled={isSavingEdit}
                                >
                                    {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onCancelEdit}
                                    disabled={isSavingEdit}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <MessageContent
                            content={message.content}
                            attachments={message.attachments}
                        />
                    )}
                </div>
            </div>

            {/* Message actions */}
            {isHovered && !isEditing && (
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
                    showAvatar={messages[index - 1]?.authorId != message.authorId}
                    isGrouped={messages[index - 1]?.authorId == message.authorId}
                    onReply={() => onReply?.(message)}
                    onEdit={() => onEdit?.(message)}
                    onDelete={() => onDelete?.(message)}
                />
            ))}
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

const MessageSkeleton = ({ showAvatar = true, isGrouped = false }: { showAvatar?: boolean; isGrouped?: boolean }) => {
    return (
        <div className={cn(
            "group relative hover:bg-accent/30 transition-colors duration-150",
            isGrouped ? "py-0.5" : "pt-2 pb-1"
        )}>
            <div className="flex gap-1">
                {/* Avatar or timestamp spacer */}
                <div className="w-16 flex-shrink-0 flex justify-center">
                    {showAvatar ? (
                        <Skeleton className="w-10 h-10 rounded-full" />
                    ) : (
                        <div className="w-10 h-10" />
                    )}
                </div>

                {/* Message content */}
                <div className="flex-1 min-w-0 m-0 my-1 p-0">
                    {showAvatar && (
                        <div className="flex items-baseline gap-2 mb-1">
                            <Skeleton className="w-24 h-4" />
                            <Skeleton className="w-16 h-3" />
                        </div>
                    )}

                    {/* Message text lines */}
                    <div className="space-y-1">
                        <Skeleton className="w-full h-4" />
                        <Skeleton className="w-3/4 h-4" />
                        {Math.random() > 0.7 && <Skeleton className="w-1/2 h-4" />}
                    </div>
                </div>
            </div>
        </div>
    )
}

const MessageListSkeleton = () => {
    // Generate 100 skeleton messages with realistic grouping
    const skeletonMessages = Array.from({ length: 15 }, (_, index) => {
        // Simulate message grouping - show avatar for first message or when "author" changes
        const showAvatar = index === 0 || Math.random() > 0.6
        const isGrouped = index > 0 && !showAvatar
        return (
            <MessageSkeleton
                key={`skeleton-${index}`}
                showAvatar={showAvatar}
                isGrouped={isGrouped}
            />
        )
    })

    return (
        <div className="pt-6 mb-0.5">
            {skeletonMessages}
        </div>
    )
}

interface MessageInputRef {
    focus: () => void;
    blur: () => void;
}

const MessageInput = React.forwardRef<MessageInputRef, {
    onSendMessage: (content: string, attachments?: string[]) => void;
    replyingTo?: Message | null;
    onCancelReply?: () => void;
    disabled?: boolean;
    messagesInChannel?: Message[];
}>(({
    onSendMessage,
    replyingTo,
    onCancelReply,
    disabled = false,
    messagesInChannel = []
}, ref) => {
    const [message, setMessage] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const [attachments, setAttachments] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mentionsInputRef = useRef<any>(null)
    const { activeServerId, activeChannelId, servers } = useServer()
    const { profiles } = useProfile()
    const isMobile = useIsMobile()
    const isMobileDevice = useIsMobileDevice()

    // Expose focus and blur methods to parent component
    React.useImperativeHandle(ref, () => ({
        focus: () => {
            // Don't autofocus on mobile devices
            if (isMobile || isMobileDevice) return

            // Focus the MentionsInput by finding its textarea element
            const mentionsContainer = mentionsInputRef.current
            if (mentionsContainer) {
                const textarea = mentionsContainer.querySelector('textarea')
                if (textarea) {
                    textarea.focus()
                }
            }
        },
        blur: () => {
            // Blur the MentionsInput by finding its textarea element
            const mentionsContainer = mentionsInputRef.current
            if (mentionsContainer) {
                const textarea = mentionsContainer.querySelector('textarea')
                if (textarea) {
                    textarea.blur()
                }
            }
        }
    }))

    // Function to get unified members data for mentions (server members + chat participants)
    const getMembersData = (query: string, callback: (data: any[]) => void) => {
        if (!activeServerId) {
            callback([])
            return
        }

        const serverMembers = servers[activeServerId]?.members || []

        // Extract unique user IDs from messages in the current channel
        const chatParticipants = new Set<string>()
        messagesInChannel.forEach(message => {
            chatParticipants.add(message.authorId)
        })

        // Create a unified list of users with their source information
        const allUsers = new Map<string, {
            id: string;
            display: string;
            isServerMember: boolean;
            isChatParticipant: boolean;
            nickname?: string;
        }>()

        // Add server members
        serverMembers.forEach(member => {
            const displayName = member.nickname || profiles[member.userId]?.primaryName || shortenAddress(member.userId)
            allUsers.set(member.userId, {
                id: member.userId,
                display: displayName,
                isServerMember: true,
                isChatParticipant: chatParticipants.has(member.userId),
                nickname: member.nickname
            })
        })

        // Add chat participants who might not be in server members list
        chatParticipants.forEach(userId => {
            if (!allUsers.has(userId)) {
                const displayName = profiles[userId]?.primaryName || shortenAddress(userId)
                allUsers.set(userId, {
                    id: userId,
                    display: displayName,
                    isServerMember: false,
                    isChatParticipant: true
                })
            }
        })

        const allUsersArray = Array.from(allUsers.values())

        // If no query, show first 10 users, prioritizing chat participants and server members
        if (!query.trim()) {
            const sortedUsers = allUsersArray
                .sort((a, b) => {
                    // Prioritize chat participants, then server members
                    if (a.isChatParticipant && !b.isChatParticipant) return -1
                    if (!a.isChatParticipant && b.isChatParticipant) return 1
                    if (a.isServerMember && !b.isServerMember) return -1
                    if (!a.isServerMember && b.isServerMember) return 1
                    return a.display.localeCompare(b.display)
                })
                .slice(0, 10)
                .map(user => ({
                    id: user.id,
                    display: user.display
                }))

            callback(sortedUsers)
            return
        } else {
            const lowerQuery = query.toLowerCase()
            const filteredUsers = allUsersArray
                .filter(user => {
                    const primaryName = profiles[user.id]?.primaryName
                    return user.display.toLowerCase().includes(lowerQuery) ||
                        user.id.toLowerCase().includes(lowerQuery) ||
                        (primaryName && primaryName.toLowerCase().includes(lowerQuery)) ||
                        (user.nickname && user.nickname.toLowerCase().includes(lowerQuery))
                })
                .sort((a, b) => {
                    // Prioritize exact matches and prefix matches
                    const aDisplay = a.display.toLowerCase()
                    const bDisplay = b.display.toLowerCase()

                    const aStartsWith = aDisplay.startsWith(lowerQuery)
                    const bStartsWith = bDisplay.startsWith(lowerQuery)

                    if (aStartsWith && !bStartsWith) return -1
                    if (!aStartsWith && bStartsWith) return 1

                    // Then prioritize chat participants and server members
                    if (a.isChatParticipant && !b.isChatParticipant) return -1
                    if (!a.isChatParticipant && b.isChatParticipant) return 1
                    if (a.isServerMember && !b.isServerMember) return -1
                    if (!a.isServerMember && b.isServerMember) return 1

                    return aDisplay.localeCompare(bDisplay)
                })
                .slice(0, 10) // Limit to 10 results
                .map(user => ({
                    id: user.id,
                    display: user.display
                }))

            callback(filteredUsers)
        }
    }

    // Enhanced custom renderer for mention suggestions
    const renderMemberSuggestion = (
        suggestion: { id: string; display: string },
        search: string,
        highlightedDisplay: React.ReactNode,
        index: number,
        focused: boolean
    ) => {
        const { profiles } = useProfile()
        const profile = profiles[suggestion.id]

        // Handle empty state
        if (suggestion.id === '__no_results__') {
            return (
                <div className="flex items-center justify-center py-6 px-3 text-muted-foreground/60">
                    <div className="text-sm">No users found</div>
                </div>
            )
        }

        // Check if user is a server member and/or chat participant
        const serverMembers = servers[activeServerId]?.members || []
        const isServerMember = serverMembers.some(member => member.userId === suggestion.id)
        const isChatParticipant = messagesInChannel.some(message => message.authorId === suggestion.id)

        return (
            <div className={`flex items-center gap-3 py-3 px-3 rounded-lg transition-all duration-150 cursor-pointer ${focused
                ? 'bg-primary/10 text-foreground shadow-sm'
                : 'hover:bg-accent/30 text-foreground'
                }`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0 flex items-center justify-center overflow-hidden border border-border/20 relative">
                    {profile?.pfp ? (
                        <img
                            src={`https://arweave.net/${profile.pfp}`}
                            alt={suggestion.display}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-sm font-semibold text-primary">
                            {suggestion.display.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm leading-tight">
                        {highlightedDisplay}
                    </div>
                    <div className="text-xs text-muted-foreground/70 leading-tight mt-0.5 font-mono">
                        {suggestion.id.substring(0, 6)}...{suggestion.id.substring(suggestion.id.length - 6)}
                    </div>
                </div>
                {focused && (
                    <div className="flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
                    </div>
                )}
            </div>
        )
    }

    // Function to get channels data for mentions
    const getChannelsData = (query: string, callback: (data: any[]) => void) => {
        if (!activeServerId) {
            callback([]);
            return;
        }

        // Get server channels
        const server = servers[activeServerId];
        if (!server?.channels) {
            callback([]);
            return;
        }

        // Filter channels based on query
        const filteredChannels = server.channels
            .filter(channel => {
                const lowerQuery = query.toLowerCase();
                return channel.name.toLowerCase().includes(lowerQuery);
            })
            .sort((a, b) => {
                // Prioritize exact matches and prefix matches
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const lowerQuery = query.toLowerCase();

                const aStartsWith = aName.startsWith(lowerQuery);
                const bStartsWith = bName.startsWith(lowerQuery);

                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;

                return aName.localeCompare(bName);
            })
            .slice(0, 10) // Limit to 10 results
            .map(channel => ({
                id: channel.channelId.toString(),
                display: channel.name
            }));

        callback(filteredChannels);
    };

    // Enhanced custom renderer for channel suggestions
    const renderChannelSuggestion = (
        suggestion: { id: string; display: string },
        search: string,
        highlightedDisplay: React.ReactNode,
        index: number,
        focused: boolean
    ) => {
        // Handle empty state
        if (suggestion.id === '__no_results__') {
            return (
                <div className="flex items-center justify-center py-6 px-3 text-muted-foreground/60">
                    <div className="text-sm">No channels found</div>
                </div>
            );
        }

        return (
            <div className={`flex items-center gap-3 py-3 px-3 rounded-lg transition-all duration-150 cursor-pointer ${focused
                ? 'bg-primary/10 text-foreground shadow-sm'
                : 'hover:bg-accent/30 text-foreground'
                }`}>
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0 flex items-center justify-center border border-border/20">
                    <Hash className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm leading-tight">
                        {highlightedDisplay}
                    </div>
                    <div className="text-xs text-muted-foreground/70 leading-tight mt-0.5">
                        Channel #{suggestion.id}
                    </div>
                </div>
                {focused && (
                    <div className="flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
                    </div>
                )}
            </div>
        );
    };

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
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow Shift+Enter for new lines
                return
            } else {
                // Enter without Shift sends the message
                e.preventDefault()
                handleSend()
            }
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

    if (!currentChannel) {
        return null
    }

    return (
        <div className="relative">
            {/* Reply indicator */}
            {replyingTo && (
                <div className="mx-3 sm:mx-4 p-2 sm:p-3 -mb-3 sm:-mb-4 bg-muted/30 rounded-t-lg border border-border/50 border-b-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <Reply className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Replying to</span>
                            <span className="font-semibold text-foreground">
                                {profiles[replyingTo.authorId]?.primaryName || shortenAddress(replyingTo.authorId)}
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
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-3 sm:pt-4">
                <div className={cn(
                    "relative flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 transition-all duration-200",
                    "hover:border-border focus-within:border-primary/50 focus-within:shadow-lg focus-within:shadow-primary/10",
                    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:opacity-0 focus-within:before:opacity-100 before:transition-opacity before:duration-300 before:rounded-lg",
                    replyingTo && "rounded-t-none border-t-0 before:rounded-t-none"
                )}>
                    {/* Attachment previews */}
                    {attachments.length > 0 && (
                        <div className="p-2 sm:p-3 border-b border-border/30">
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
                    <div className="flex items-center justify-center grow gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-3 relative z-10">
                        {/* Left actions */}
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-muted rounded transition-colors"
                                onClick={handleFileUpload}
                                // disabled={disabled}
                                disabled
                            >
                                <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                        </div>

                        {/* Text input */}
                        <div className="flex relative items-center min-h-[20px] z-0 grow" ref={mentionsInputRef}>
                            <MentionsInput
                                autoFocus={!isMobile}
                                value={message}
                                onChange={(event, newValue) => handleTyping(newValue)}
                                onKeyDown={handleKeyPress}
                                placeholder={`Message #${currentChannel.name}`}
                                disabled={disabled}
                                singleLine={false}
                                rows={message.split("\n").length > 10 ? 10 : message.split("\n").length}
                                forceSuggestionsAboveCursor
                                a11ySuggestionsListLabel="Suggested mentions"
                                className="grow p-0 m-0 relative mentions-input"
                                style={{
                                    control: {
                                        backgroundColor: 'transparent',
                                        fontWeight: 'normal',
                                        border: 'none',
                                        outline: 'none',
                                        minHeight: '20px',
                                        maxHeight: '150px',
                                        padding: '0',
                                        lineHeight: '1.5',
                                        overflow: 'hidden',
                                        position: 'relative',
                                    },
                                    '&multiLine': {
                                        control: {
                                            fontFamily: 'inherit',
                                            minHeight: '20px',
                                            maxHeight: '150px',
                                            border: 'none',
                                            outline: 'none',
                                            overflow: 'hidden',
                                            position: 'relative',
                                        },
                                        highlighter: {
                                            padding: '0',
                                            border: 'none',
                                            minHeight: '20px',
                                            maxHeight: '150px',
                                            margin: '0',
                                            overflow: 'auto',
                                            zIndex: 10,
                                            opacity: 0.65,
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            pointerEvents: 'none',
                                        },
                                        input: {
                                            padding: '0',
                                            fontSize: '14px !important',
                                            border: 'none',
                                            outline: 'none',
                                            backgroundColor: 'transparent',
                                            color: 'var(--foreground)',
                                            fontFamily: 'inherit',
                                            lineHeight: '1.5',
                                            minHeight: '20px',
                                            maxHeight: '150px',
                                            resize: 'none',
                                            overflow: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                            scrollbarWidth: 'none',
                                            scrollbarColor: 'transparent',
                                            position: 'relative',
                                            zIndex: 3,
                                        },
                                    },
                                    '&singleLine': {
                                        control: {
                                            fontFamily: 'inherit',
                                            minHeight: '20px',
                                            border: 'none',
                                            outline: 'none',
                                        },
                                        highlighter: {
                                            padding: '0',
                                            border: 'none',
                                            minHeight: '20px',
                                            zIndex: 1,
                                        },
                                        input: {
                                            padding: '0',
                                            border: 'none',
                                            outline: 'none',
                                            backgroundColor: 'transparent',
                                            color: 'hsl(var(--foreground))',
                                            fontFamily: 'inherit',
                                            lineHeight: '1.5',
                                            minHeight: '20px',
                                            resize: 'none',
                                        },
                                    },
                                    suggestions: {
                                        zIndex: 99,
                                        backgroundColor: "transparent",
                                        width: '100%',
                                        list: {
                                            backgroundColor: 'var(--background)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '16px',
                                            // fontSize: '14px',
                                            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(255 255 255 / 0.05)',
                                            maxHeight: '280px',
                                            minWidth: '320px',
                                            overflowY: 'auto',
                                            overflowX: 'hidden',
                                            padding: '8px',
                                            backdropFilter: 'blur(12px)',
                                            scrollbarWidth: 'thin',
                                            scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent',
                                            position: "relative",
                                            bottom: '26px'
                                        },
                                        item: {
                                            padding: '0',
                                            border: 'none',
                                            borderRadius: '0',
                                            margin: '0',
                                            backgroundColor: 'transparent',
                                            '&focused': {
                                                backgroundColor: 'transparent',
                                            },
                                        },
                                    },
                                }}
                            >
                                <Mention
                                    data={getMembersData}
                                    trigger="@"
                                    markup="@[__display__](__id__)"
                                    displayTransform={(id) => {
                                        // Look up the display name for this ID
                                        const member = servers[activeServerId]?.members?.find(m => m.userId === id)
                                        const displayName = member?.nickname || profiles[id]?.primaryName || shortenAddress(id)
                                        return `@${displayName}`
                                    }}
                                    appendSpaceOnAdd
                                    className="mention-highlight z-10"
                                    style={{
                                        backgroundColor: 'var(--primary)',
                                        color: 'var(--primary-foreground)',
                                        padding: '1px 0px',
                                        borderRadius: '3px',
                                        fontWeight: '500',
                                        // fontSize: '14px',
                                    }}
                                    renderSuggestion={renderMemberSuggestion}
                                />
                                <Mention
                                    data={getChannelsData}
                                    trigger="#"
                                    markup="#[__display__](__id__)"
                                    displayTransform={(id) => {
                                        // Look up the channel name for this ID
                                        const channel = servers[activeServerId]?.channels?.find(c => c.channelId.toString() === id)
                                        return `#${channel?.name || id}`
                                    }}
                                    appendSpaceOnAdd
                                    className="mention-highlight z-10"
                                    style={{
                                        backgroundColor: 'var(--primary)',
                                        color: 'var(--primary-foreground)',
                                        padding: '1px 0px',
                                        borderRadius: '3px',
                                        fontWeight: '500',
                                        // fontSize: '14px',
                                    }}
                                    renderSuggestion={renderChannelSuggestion}
                                />
                            </MentionsInput>
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-1">
                            {/* <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-muted rounded-md transition-colors"
                                disabled={disabled}
                            >
                                <Smile className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                            </Button> */}

                            {/* Send button - only show when there's content */}
                            {(
                                <Button
                                    size="sm"
                                    className={cn(
                                        "h-8 w-8 p-0 ml-2 transition-all duration-200",
                                        "bg-primary hover:bg-primary/90 text-primary-foreground",
                                        "shadow-lg shadow-primary/20 hover:shadow-primary/30",
                                        "hover:scale-105 active:scale-95"
                                    )}
                                    onClick={handleSend}
                                    disabled={disabled || !(message.trim() || attachments.length > 0)}
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
})

export default function MessageList(props: React.HTMLAttributes<HTMLDivElement> & {
    onToggleMemberList?: () => void;
    showMemberList?: boolean;
}) {
    const { onToggleMemberList, showMemberList, ...htmlProps } = props
    const { messages, actions: messageActions, loadingMessages } = useMessages()
    const { activeServerId, activeChannelId, servers } = useServer()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const messageInputRef = useRef<MessageInputRef>(null)
    const subspace = useSubspace()
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)
    const { address } = useWallet()
    const isMobile = useIsMobile()
    const isMobileDevice = useIsMobileDevice()

    // State for editing messages
    const [editingMessage, setEditingMessage] = useState<Message | null>(null)
    const [editedContent, setEditedContent] = useState("")
    const [isSavingEdit, setIsSavingEdit] = useState(false)
    const [isDeletingMessage, setIsDeletingMessage] = useState(false)

    // State for join server dialog
    const [joinDialogOpen, setJoinDialogOpen] = useState(false)
    const [joinDialogInviteLink, setJoinDialogInviteLink] = useState("")

    // Track previous message count to detect first-time loading
    const prevMessageCountRef = useRef<number>(0)

    // Check if no channel is selected
    const hasActiveChannel = activeChannelId && activeChannelId !== 0

    // Create join dialog context value
    const joinDialogContext = useMemo(() => ({
        openJoinDialog: (inviteLink: string) => {
            console.log('Opening join dialog with invite link:', inviteLink);
            setJoinDialogInviteLink(inviteLink);
            setJoinDialogOpen(true);
        }
    }), []);

    // Get messages for the active channel
    const messagesInChannel = useMemo(() => {
        if (!activeServerId || !hasActiveChannel || !messages[activeServerId]?.[activeChannelId]) {
            return []
        }

        return Object.values(messages[activeServerId][activeChannelId])
            .sort((a, b) => a.timestamp - b.timestamp)
    }, [messages, activeServerId, activeChannelId, hasActiveChannel])

    // No grouping - just use individual messages
    const individualMessages = messagesInChannel

    // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container) return

        // Check if user is near the bottom (within 100px)
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 200

        // Only auto-scroll if user is near the bottom
        if (isNearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [individualMessages.length])

    // Initial scroll to bottom when channel changes or component mounts
    useEffect(() => {
        // Reset the previous message count when channel changes
        prevMessageCountRef.current = 0

        if (messagesInChannel.length > 0) {
            // Use setTimeout to ensure DOM is updated
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
            }, 0)
        }
    }, [activeChannelId, activeServerId])

    // Scroll to bottom when messages load for the first time (empty list -> has messages)
    useEffect(() => {
        const currentMessageCount = messagesInChannel.length
        const previousMessageCount = prevMessageCountRef.current

        // If we went from 0 messages to having messages, scroll to bottom
        if (previousMessageCount === 0 && currentMessageCount > 0) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100) // Slightly longer delay to ensure DOM is fully updated
        }

        // Update the ref with current count
        prevMessageCountRef.current = currentMessageCount
    }, [messagesInChannel.length])

    // Scroll to bottom when skeleton loader is shown
    useEffect(() => {
        if (loadingMessages && messagesInChannel.length === 0) {
            // Use a longer timeout to ensure skeleton is rendered
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
            }, 200)
        }
    }, [loadingMessages, messagesInChannel.length])

    // Mobile-specific: Handle scroll to blur input
    useEffect(() => {
        if (!isMobile && !isMobileDevice) return

        const container = messagesContainerRef.current
        if (!container) return

        const handleScroll = () => {
            // Blur the message input when scrolling on mobile
            messageInputRef.current?.blur()
        }

        container.addEventListener('scroll', handleScroll, { passive: true })
        return () => container.removeEventListener('scroll', handleScroll)
    }, [isMobile, isMobileDevice])

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
        // Focus the message input after setting the reply
        setTimeout(() => {
            messageInputRef.current?.focus()
        }, 100)
    }

    const handleCancelReply = () => {
        setReplyingTo(null)
    }

    const handleEdit = (message: Message) => {
        setEditingMessage(message)
        setEditedContent(message.content)
    }

    const handleCancelEdit = () => {
        setEditingMessage(null)
        setEditedContent("")
    }

    const handleSaveEdit = async () => {
        if (!editingMessage || !editedContent.trim() || !activeServerId) {
            return
        }

        setIsSavingEdit(true)

        try {
            // Optimistic update - update the message in local state immediately
            const updatedMessage: Message = {
                ...editingMessage,
                content: editedContent.trim(),
                edited: 1
            }
            messageActions.updateMessage(activeServerId, activeChannelId, editingMessage.messageId, updatedMessage)

            // Send the edit to the server
            const success = await subspace.server.message.editMessage({
                serverId: activeServerId,
                messageId: editingMessage.messageId.toString(),
                content: editedContent.trim()
            })

            if (success) {
                // Exit edit mode
                setEditingMessage(null)
                setEditedContent("")

                // Refresh messages after a small delay to get the updated message from server
                setTimeout(() => {
                    // The real-time updates should handle this, but we can add a manual refresh if needed
                    console.log('Message edited successfully')
                }, 500)
            } else {
                throw new Error('Failed to edit message')
            }
        } catch (error) {
            console.error("Error editing message:", error)
            toast.error("Failed to edit message")

            // Revert the optimistic update by refreshing messages
            // The real-time system should handle this automatically
        } finally {
            setIsSavingEdit(false)
        }
    }

    const handleDelete = (message: Message) => {
        if (!activeServerId) return

        // Show a confirmation dialog with note about Arweave permanence
        toast.warning("Delete message?", {
            description: "This will remove the message from the UI, but due to Arweave's permanent nature, the message data will still exist on the blockchain.",
            action: {
                label: "Delete",
                onClick: () => performMessageDeletion(message)
            },
            cancel: {
                label: "Cancel",
                onClick: () => { /* Do nothing */ }
            },
            duration: 10000 // 10 seconds to give time to read
        })
    }

    const performMessageDeletion = async (message: Message) => {
        if (!activeServerId) return

        setIsDeletingMessage(true)

        try {
            // Optimistic update - remove the message from local state immediately
            messageActions.removeMessage(activeServerId, activeChannelId, message.messageId)

            // Send delete request to server
            const success = await subspace.server.message.deleteMessage({
                serverId: activeServerId,
                messageId: message.messageId.toString()
            })

            if (success) {
                // Refresh messages after a small delay to ensure consistency
                setTimeout(() => {
                    console.log('Message deleted successfully')
                }, 500)
            } else {
                throw new Error('Failed to delete message')
            }
        } catch (error) {
            console.error("Error deleting message:", error)
            toast.error("Failed to delete message")

            // Revert the optimistic update by refreshing messages
            // The real-time system should handle this automatically
        } finally {
            setIsDeletingMessage(false)
        }
    }

    const handleJumpToMessage = (messageId: number) => {
        // Find the message element and scroll to it
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
        if (messageElement) {
            messageElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            })

            // Add a brief highlight effect with animation
            messageElement.classList.add('bg-primary/20', 'transition-colors', 'duration-300')
            setTimeout(() => {
                messageElement.classList.remove('bg-primary/20')
                setTimeout(() => {
                    messageElement.classList.remove('transition-colors', 'duration-300')
                }, 300)
            }, 1500)
        } else {
            // Message not found in current view
            toast.info("Message not found in current view", {
                description: "The message you're looking for might be in a different part of the conversation."
            })
        }
    }

    // Calculate viewport height - MUST be before any early returns to avoid hooks error
    const viewportHeight = useMemo(() => {
        return window.innerHeight
    }, [])

    // If no channel is selected, show the no channel state
    if (!hasActiveChannel) {
        return (
            <JoinServerDialogContext.Provider value={joinDialogContext}>
                <div
                    {...htmlProps}
                    className={cn(
                        "flex flex-col h-full relative",
                        "bg-gradient-to-b from-background via-background/98 to-background/95 truncate whitespace-normal",
                        // Subtle pattern overlay
                        "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.01)_0%,transparent_50%)] before:pointer-events-none",
                        htmlProps.className
                    )}
                    style={{
                        ...htmlProps.style
                    }}
                >
                    {/* Ambient glow at top */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-16 bg-primary/3 rounded-full blur-3xl" />

                    <NoChannel serverName={currentServer?.name} />

                    {/* Ambient glow at bottom */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-primary/2 rounded-full blur-2xl" />

                    {/* Join Server Dialog */}
                    <JoinServerDialog
                        open={joinDialogOpen}
                        onOpenChange={setJoinDialogOpen}
                        initialInput={joinDialogInviteLink}
                    />
                </div>
            </JoinServerDialogContext.Provider>
        )
    }

    return (
        <JoinServerDialogContext.Provider value={joinDialogContext}>
            <div
                {...htmlProps}
                className={cn(
                    "flex flex-col h-full relative overflow-clip",
                    "bg-gradient-to-b from-background via-background/98 to-background/95 truncate whitespace-normal",
                    // Subtle pattern overlay
                    "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.01)_0%,transparent_50%)] before:pointer-events-none",
                    htmlProps.className
                )}
                style={{
                    ...htmlProps.style,
                    maxHeight: `${viewportHeight}px !important`
                }}
            >
                {/* Ambient glow at top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-16 bg-primary/3 rounded-full blur-3xl" />

                {/* Channel Header */}
                <ChannelHeader
                    channelName={currentChannel?.name}
                    // channelDescription="A place to hangout with intellects and like minded people! 🧠"
                    memberCount={currentServer?.member_count}
                    onToggleMemberList={onToggleMemberList}
                    showMemberList={showMemberList}
                />

                {/* Messages container */}
                <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40"
                >
                    {loadingMessages && individualMessages.length === 0 ? (
                        <>
                            <MessageListSkeleton />
                            <div ref={messagesEndRef} />
                        </>
                    ) : individualMessages.length === 0 ? (
                        <EmptyChannelState channelName={currentChannel?.name} />
                    ) : (
                        <div className="pt-6">
                            {individualMessages.map((message, index) => (
                                <div key={message.messageId} data-message-id={message.messageId}>
                                    <MessageItem
                                        message={message}
                                        showAvatar={index == 0 || individualMessages[index - 1]?.authorId != message.authorId}
                                        isGrouped={index > 0 && individualMessages[index - 1]?.authorId == message.authorId}
                                        onReply={() => handleReply(message)}
                                        onEdit={() => handleEdit(message)}
                                        onDelete={() => handleDelete(message)}
                                        isEditing={editingMessage?.messageId === message.messageId}
                                        editedContent={editedContent}
                                        onEditContentChange={setEditedContent}
                                        onSaveEdit={handleSaveEdit}
                                        onCancelEdit={handleCancelEdit}
                                        isSavingEdit={isSavingEdit}
                                        allMessages={messages[activeServerId]?.[activeChannelId] || {}}
                                        onJumpToMessage={handleJumpToMessage}
                                    />
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
                {/* Message input */}
                <MessageInput
                    ref={messageInputRef}
                    onSendMessage={handleSendMessage}
                    replyingTo={replyingTo}
                    onCancelReply={handleCancelReply}
                    disabled={!activeServerId || !hasActiveChannel}
                    messagesInChannel={messagesInChannel}
                />

                {/* Join Server Dialog */}
                <JoinServerDialog
                    open={joinDialogOpen}
                    onOpenChange={setJoinDialogOpen}
                    initialInput={joinDialogInviteLink}
                />
            </div>
        </JoinServerDialogContext.Provider>
    )
}