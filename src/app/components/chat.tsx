import { useGlobalState } from "@/hooks/global-state";
import { HashIcon, Loader2, Send } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import type { Channel } from "@/lib/types";
import { getMessages, sendMessage } from "@/lib/ao";
import { toast } from "sonner";

// Message type from server
interface Message {
    id: number;
    content: string;
    channel_id: number;
    author_id: string;
    msg_id: string;
    timestamp: number;
    edited: number;
}

// API response type
interface MessagesResponse {
    success: boolean;
    messages: Message[];
}

export default function Chat() {
    const {
        activeServer,
        activeChannelId,
        activeServerId,
        getChannelMessages,
        cacheChannelMessages
    } = useGlobalState();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const previousChannelIdRef = useRef<number | null>(null);

    // Find the active channel from the server data
    const activeChannel = useMemo(() => {
        if (!activeServer || activeChannelId === null) return null;
        return activeServer.channels.find(channel => channel.id === activeChannelId) || null;
    }, [activeServer, activeChannelId]);

    // Clear messages and fetch new ones when channel changes
    useEffect(() => {
        // Channel has changed
        if (previousChannelIdRef.current !== activeChannelId) {
            // Clear messages when explicitly switching channels (not on initial load)
            if (previousChannelIdRef.current !== null) {
                setMessages([]);
            }

            previousChannelIdRef.current = activeChannelId;

            // Check if there are cached messages for this channel
            if (activeChannelId) {
                const cachedMessages = getChannelMessages(activeChannelId);

                if (cachedMessages) {
                    console.log(`[Chat] Using cached messages for channel ${activeChannelId}`);
                    setMessages(cachedMessages);
                    setIsLoadingMessages(false);
                } else {
                    // Only show loading if we don't have cached messages
                    setIsLoadingMessages(true);
                    // Don't clear messages here, to avoid flickering
                }
            }
        }

        if (activeServerId && activeChannelId) {
            fetchMessages(true);
        }
    }, [activeServerId, activeChannelId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch messages periodically (every 5 seconds)
    useEffect(() => {
        if (!activeServerId || !activeChannelId) return;

        const intervalId = setInterval(() => {
            fetchMessages(true); // Silent refresh (no loading indicator)
        }, 5000);

        return () => {
            clearInterval(intervalId);
            // Clear messages when unmounting this channel
            if (previousChannelIdRef.current === activeChannelId) {
                previousChannelIdRef.current = null;
            }
        };
    }, [activeServerId, activeChannelId]);

    const fetchMessages = async (showLoading = true) => {
        if (!activeServerId || !activeChannelId) return;

        try {
            if (showLoading) {
                // Only show loading indicator if we have no messages
                setIsLoadingMessages(true);
            }

            console.log(`Fetching messages for channel ${activeChannelId} in server ${activeServerId}`);
            const result = await getMessages(activeServerId, activeChannelId);

            // Parse and handle the response
            if (result) {
                const response = result as unknown as MessagesResponse;

                if (response.success && Array.isArray(response.messages)) {
                    // Sort messages by timestamp (newest last)
                    const sortedMessages = [...response.messages].sort(
                        (a, b) => a.timestamp - b.timestamp
                    );

                    // Only update if this is still the active channel
                    if (activeChannelId === previousChannelIdRef.current) {
                        setMessages(sortedMessages);

                        // Cache the sorted messages
                        cacheChannelMessages(activeChannelId, sortedMessages);
                    }
                } else {
                    console.warn("Unexpected message format:", result);
                    // Only clear messages if we get an explicit empty result
                    if (activeChannelId === previousChannelIdRef.current) {
                        setMessages([]);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
            if (showLoading) {
                toast.error("Failed to load messages");
            }
            // Don't clear messages on error
        } finally {
            if (showLoading) {
                setIsLoadingMessages(false);
            }
        }
    };

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();

        if (!messageInput.trim() || !activeServerId || !activeChannelId || !activeChannel) {
            return;
        }

        setIsSending(true);

        try {
            // Create an optimistic message update
            const optimisticMessage = {
                id: Date.now(), // Temporary ID
                content: messageInput.trim(),
                channel_id: activeChannelId,
                author_id: await window.arweaveWallet.getActiveAddress(),
                msg_id: `optimistic-${Date.now()}`, // Temporary message ID
                timestamp: Math.floor(Date.now() / 1000),
                edited: 0
            };

            // Update UI immediately with optimistic message
            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
            setMessageInput("");

            // Actually send the message
            await sendMessage(
                activeServerId,
                activeChannelId,
                optimisticMessage.content
            );

            // Fetch updated messages after a small delay
            setTimeout(() => fetchMessages(false), 500);
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message");

            // Remove the optimistic message if sending failed
            setMessages((prevMessages) =>
                prevMessages.filter(msg => !msg.msg_id.startsWith('optimistic-'))
            );
        } finally {
            setIsSending(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const formatTimestamp = (timestamp: number) => {
        // Check if timestamp is in milliseconds (13 digits) or seconds (10 digits)
        const date = timestamp.toString().length > 10
            ? new Date(timestamp)  // Already in milliseconds
            : new Date(timestamp * 1000);  // Convert from seconds to milliseconds

        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        // Calculate yesterday without modifying the now variable
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = yesterday.toDateString() === date.toDateString();

        // Format time with AM/PM
        const timeString = date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        if (isToday) {
            // Today: just show time
            return timeString;
        } else if (isYesterday) {
            // Yesterday: show "Yesterday at TIME"
            return `Yesterday at ${timeString}`;
        } else {
            // Older: show date and time
            const dateString = date.toLocaleDateString([], {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            return `${dateString} at ${timeString}`;
        }
    };

    const formatFullDate = (timestamp: number) => {
        // Check if timestamp is in milliseconds (13 digits) or seconds (10 digits)
        const date = timestamp.toString().length > 10
            ? new Date(timestamp)  // Already in milliseconds
            : new Date(timestamp * 1000);  // Convert from seconds to milliseconds

        // Full date and time format for tooltip
        return date.toLocaleString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Loading or no channel selected
    if (!activeServer) {
        return (
            <div className="flex items-center justify-center h-full w-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // No channel selected yet
    if (!activeChannel) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full text-muted-foreground">
                <div className="text-lg">Select a channel to start chatting</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col">
            {/* Channel Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border/30 h-14">
                <HashIcon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{activeChannel?.name}</span>
                {isLoadingMessages && (
                    <div className="relative group">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-background border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                            Loading messages...
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col relative">
                {/* Loading overlay shown only when refreshing with existing messages */}
                {/* {isLoadingMessages && messages.length > 0 && (
                    <div className="absolute top-2 right-2 z-10">
                        <div className="bg-background/80 backdrop-blur-sm rounded-md p-1 flex items-center shadow-sm">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            <span className="text-xs">Updating...</span>
                        </div>
                    </div>
                )} */}

                {isLoadingMessages && messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length > 0 ? (
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div key={message.msg_id} className="group">
                                <div className="flex items-start gap-2">
                                    <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        <span className="text-xs">{message.author_id.substring(0, 2)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-semibold text-sm truncate">
                                                {message.author_id.substring(0, 6)}...{message.author_id.substring(message.author_id.length - 4)}
                                            </span>
                                            <span
                                                className="text-xs text-muted-foreground whitespace-nowrap"
                                                title={formatFullDate(message.timestamp)}
                                            >
                                                {formatTimestamp(message.timestamp)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm break-words">{message.content}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-8 flex-1 flex flex-col items-center justify-center">
                        <p className="text-sm">This is the start of the #{activeChannel?.name} channel.</p>
                        <p className="text-xs mt-1">Be the first to send a message!</p>
                    </div>
                )}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-border/30">
                <form onSubmit={handleSendMessage} className="relative rounded-md overflow-hidden">
                    <input
                        type="text"
                        placeholder={`Message #${activeChannel.name}`}
                        className="w-full py-2 px-3 pr-10 bg-muted/50 rounded-md border-none focus:outline-none"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        disabled={isSending}
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        disabled={!messageInput.trim() || isSending}
                    >
                        {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}