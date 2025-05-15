import { useGlobalState } from "@/hooks/global-state";
import { ArrowLeft, HashIcon, Send, Users, Loader2 } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import type { Channel } from "@/lib/types";
import { getMessages, sendMessage, getProfile } from "@/lib/ao";
import { toast } from "sonner";
import { useMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import UserProfilePopover from "./user-profile-popover";
import { PopoverTrigger } from "@/components/ui/popover";
import { MentionsInput, Mention } from 'react-mentions';

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

// Style for mentions input
const mentionsInputStyle = {
    control: {
        backgroundColor: 'transparent',
        // fontSize: 14,
        fontWeight: 'normal',
    },
    input: {
        margin: 0,
        padding: '8px 10px',
        overflow: 'auto',
        height: '40px',
        borderRadius: '6px',
    },
    suggestions: {
        backgroundColor: 'transparent',
        list: {
            backgroundColor: 'var(--secondary)',
            padding: '4px 8px',
            borderRadius: '6px',
            // border: '1px solid rgba(0,0,0,0.15)',
            // fontSize: 14,
        },
        item: {
            // padding: '10px',
            borderRadius: '6px',
            margin: '4px 0px',
            // borderBottom: '1px solid rgba(0,0,0,0.15)',
            '&focused': {
                backgroundColor: 'var(--input)',
            },
        },
    },
    highlighter: {
        overflow: 'hidden',
    },
};

export default function Chat() {
    const {
        activeServer,
        activeChannelId,
        activeServerId,
        getChannelMessages,
        cacheChannelMessages,
        showUsers,
        setShowUsers,
        getUserProfile,
        // Use the centralized profile cache
        userProfilesCache,
        getUserProfileFromCache,
        updateUserProfileCache,
        fetchUserProfileAndCache,
        getServerMembers
    } = useGlobalState();
    const isMobile = useMobile();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const previousChannelIdRef = useRef<number | null>(null);
    const activeUserProfilesRef = useRef<Set<string>>(new Set());
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

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

            // Reset active user profiles set when channel changes
            activeUserProfilesRef.current = new Set();

            // Check if there are cached messages for this channel
            if (activeChannelId) {
                const cachedMessages = getChannelMessages(activeChannelId);

                if (cachedMessages) {
                    console.log(`[Chat] Using cached messages for channel ${activeChannelId}`);
                    setMessages(cachedMessages);
                    // Don't show loading indicator when using cache
                    setIsLoadingMessages(false);

                    // Immediately preload profiles for the cached messages
                    // This ensures profile data is loaded as soon as cached messages are displayed
                    preloadAllProfiles(cachedMessages);
                } else {
                    // No cached messages found - keep messages empty
                    setMessages([]);
                    // Load silently in background with no indicator
                    setIsLoadingMessages(false);
                }
            }
        }

        if (activeServerId && activeChannelId) {
            fetchMessages(false); // Don't show loading for initial fetch
        }

        // Clean up any aborted fetch when channel changes
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [activeServerId, activeChannelId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch messages periodically (every 5 seconds)
    useEffect(() => {
        if (!activeServerId || !activeChannelId) return;

        const intervalId = setInterval(() => {
            fetchMessages(false); // Silent refresh
        }, 5000);

        return () => {
            clearInterval(intervalId);
            // Clear messages when unmounting this channel
            if (previousChannelIdRef.current === activeChannelId) {
                previousChannelIdRef.current = null;
            }
        };
    }, [activeServerId, activeChannelId]);

    // Function to preload all profiles from message list at once
    const preloadAllProfiles = (messageList: Message[]) => {
        if (!messageList || messageList.length === 0) return;

        console.log(`[Chat] Preloading profiles for ${messageList.length} messages`);

        // Extract unique authors from messages
        const uniqueAuthors = Array.from(new Set(messageList.map(msg => msg.author_id)));
        console.log(`[Chat] Found ${uniqueAuthors.length} unique authors to load`);

        // First check which authors we already have in cache
        const authorsToLoad = uniqueAuthors.filter(authorId => {
            // Skip if already in cache and cache is fresh (less than 5 min old)
            const cachedProfile = getUserProfileFromCache(authorId);
            return !(cachedProfile &&
                Date.now() - cachedProfile.timestamp < 5 * 60 * 1000);
        });

        if (authorsToLoad.length === 0) {
            console.log('[Chat] All profiles already in cache');
            return;
        }

        console.log(`[Chat] Loading profiles for ${authorsToLoad.length} authors`);

        // If we have authors to load, update loading state
        if (authorsToLoad.length > 0) {
            setIsLoadingProfiles(true);

            let completedLoads = 0;

            // Update the queueProfileLoad function to track completion
            const queueProfileLoad = (authorId: string) => {
                fetchUserProfileAndCache(authorId)
                    .finally(() => {
                        completedLoads++;
                        // When all profiles are loaded, update the loading state
                        if (completedLoads >= authorsToLoad.length) {
                            setIsLoadingProfiles(false);
                        }
                    });
            };

            // Load profiles with slight delays to avoid rate limiting
            authorsToLoad.forEach((authorId, index) => {
                // Add increasing delay for each author to prevent server overload
                // Wait 500ms between requests to avoid rate limiting
                setTimeout(() => {
                    queueProfileLoad(authorId);
                }, index * 500); // 500ms between each request
            });
        }
    };

    const fetchMessages = async (showLoading = false) => {
        if (!activeServerId || !activeChannelId) return;

        try {
            // We're disabling loading indicators by default
            if (showLoading) {
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

                        // Load profiles for message authors - using a new preload function
                        preloadAllProfiles(sortedMessages);
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
            // Don't show toast errors for silent fetches
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

    // Handle mention input value change
    const handleMentionInputChange = (event: any, newValue: string, newPlainTextValue: string, mentions: any[]) => {
        setMessageInput(newValue);
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

    // Get display name for a user
    const getDisplayName = (userId: string) => {
        // First try to get nickname from server members
        const members = getServerMembers(activeServerId || "");
        if (members) {
            const member = members.find(m => m.id === userId);
            if (member && member.nickname) {
                return member.nickname;
            }
        }

        // Check profile cache from global state
        const profileData = getUserProfileFromCache(userId);

        // Use primaryName if available
        if (profileData?.primaryName) {
            return profileData.primaryName;
        }

        // Fall back to wallet address
        return `${userId.substring(0, 6)}...${userId.substring(userId.length - 4)}`;
    };

    // Get profile picture for a user
    const getProfilePicture = (userId: string) => {
        // Check profile cache from global state
        const profileData = getUserProfileFromCache(userId);
        return profileData?.pfp;
    };

    // Function to get members data for mentions
    const getMembersData = (query: string, callback: (data: any[]) => void) => {
        if (!activeServerId) {
            callback([]);
            return;
        }

        // Get server members
        const members = getServerMembers(activeServerId);
        if (!members || members.length === 0) {
            callback([]);
            return;
        }

        // Filter and format members for the mentions component
        const filteredMembers = members
            .filter(member => {
                const displayName = getDisplayName(member.id);
                return displayName.toLowerCase().includes(query.toLowerCase());
            })
            .map(member => {
                const displayName = getDisplayName(member.id);
                return {
                    id: member.id,
                    display: displayName
                };
            });

        callback(filteredMembers);
    };

    // Custom renderer for the mention suggestions
    const renderMemberSuggestion = (
        suggestion: { id: string; display: string },
        search: string,
        highlightedDisplay: React.ReactNode,
        index: number,
        focused: boolean
    ) => {
        const profilePic = getProfilePicture(suggestion.id);

        return (
            <div className={`flex items-center gap-3 py-1.5 px-2 ${focused ? 'bg-accent/20' : ''} hover:bg-accent/10 transition-colors`}>
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {profilePic ? (
                        <img
                            src={`https://arweave.net/${profilePic}`}
                            alt={suggestion.display}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.src = '';
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = suggestion.display.substring(0, 2).toUpperCase();
                            }}
                        />
                    ) : (
                        <span className="text-xs font-medium">{suggestion.display.substring(0, 2).toUpperCase()}</span>
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-foreground">{highlightedDisplay}</span>
                    <span className="text-xs text-muted-foreground">
                        {suggestion.id.substring(0, 6)}...{suggestion.id.substring(suggestion.id.length - 4)}
                    </span>
                </div>
            </div>
        );
    };

    // Generate placeholder messages for empty state or loading state
    const renderPlaceholderMessages = () => (
        <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={`placeholder-${i}`}>
                    <div className="flex items-start gap-2">
                        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="flex gap-2 items-center mb-2">
                                <Skeleton className="w-24 h-4" />
                                <Skeleton className="w-16 h-3" />
                            </div>
                            <div className="space-y-1.5">
                                <Skeleton className="w-full h-3" />
                                <Skeleton className="w-4/5 h-3" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    // Function to format mentions in message text
    const formatMessageWithMentions = (content: string) => {
        // Check if the content contains mentions in the format @[display](id)
        if (!content.includes('@[')) {
            return content;
        }

        // Regular expression to match mentions in the format @[display](id)
        const mentionRegex = /@\[(.*?)\]\((.*?)\)/g;

        // Split the content by mentions
        const parts = content.split(mentionRegex);

        // If no matches found, return the original content
        if (parts.length === 1) {
            return content;
        }

        // Build the result with formatted mentions
        const result: React.ReactNode[] = [];
        let i = 0;

        let match;
        let lastIndex = 0;
        const regex = new RegExp(mentionRegex);

        // Process each match
        while ((match = regex.exec(content)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                result.push(content.substring(lastIndex, match.index));
            }

            // Extract display name and user ID
            const displayName = match[1];
            const userId = match[2];

            // Add the mention with the proper styling
            result.push(
                <UserProfilePopover key={`mention-${i++}`} userId={userId} side="top" align="center">
                    <PopoverTrigger asChild>
                        <span
                            className="bg-indigo-400/40 dark:bg-indigo-600/40 hover:bg-indigo-400/60 dark:hover:bg-indigo-600/60 px-1 py-0.5 rounded cursor-pointer transition-colors duration-200"
                        >
                            @{displayName}
                        </span>
                    </PopoverTrigger>
                </UserProfilePopover>
            );

            lastIndex = match.index + match[0].length;
        }

        // Add any remaining text
        if (lastIndex < content.length) {
            result.push(content.substring(lastIndex));
        }

        return result;
    };

    // Loading or no server selected - show placeholder
    if (!activeServer) {
        return (
            <div className="flex items-center justify-center h-full w-full">
                <div className="text-muted-foreground px-4 py-2 rounded-md border border-border/50">
                    Select a server to continue
                </div>
            </div>
        );
    }

    // No channel selected yet
    if (!activeChannel) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full text-muted-foreground">
                <div className="text-lg text-center">Select a channel to start chatting</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col">
            {/* Channel Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border/30 h-14">
                {isMobile && <Button variant="ghost" size="icon" className="!p-0 -ml-1" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} className="!h-5 !w-5 text-muted-foreground" />
                </Button>}
                <HashIcon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{activeChannel?.name}</span>
                {(activeServer?.member_count > 0 || showUsers) && (
                    <Button variant="ghost" size="icon" data-state={showUsers ? "active" : "inactive"}
                        className="!p-0 ml-auto data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                        onClick={() => {
                            // Toggle users panel visibility
                            setShowUsers(!showUsers);

                            // If we're opening the panel, refresh member data in the background
                            if (!showUsers && activeServerId) {
                                console.log(`[Chat] Refreshing members data for ${activeServerId}`);
                                // Use the global state's fetchServerMembers with forceRefresh=true to bypass cache
                                const globalState = useGlobalState.getState();
                                globalState.fetchServerMembers(activeServerId, true)
                                    .catch(error => console.warn("Failed to refresh members:", error));
                            }
                        }}>
                        <Users size={20} className="!h-5 !w-5" />
                    </Button>
                )}
            </div>

            {/* Chat Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col relative">
                {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col justify-center">
                        {renderPlaceholderMessages()}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div key={message.msg_id} className="group">
                                <div className="flex items-start gap-3">
                                    {/* Profile avatar - wrapped in the popover */}
                                    <UserProfilePopover
                                        userId={message.author_id}
                                        side="right"
                                        align="start"
                                    >
                                        <PopoverTrigger asChild>
                                            <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer">
                                                {getProfilePicture(message.author_id) ? (
                                                    <img
                                                        src={`https://arweave.net/${getProfilePicture(message.author_id)}`}
                                                        alt={getDisplayName(message.author_id)}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            // Handle broken images by showing fallback
                                                            e.currentTarget.src = '';
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.parentElement!.innerHTML = message.author_id.substring(0, 2).toUpperCase();
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="text-base font-medium">{message.author_id.substring(0, 2).toUpperCase()}</span>
                                                )}
                                            </div>
                                        </PopoverTrigger>
                                    </UserProfilePopover>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            {/* Username with popover */}
                                            <UserProfilePopover
                                                userId={message.author_id}
                                                side="top"
                                                align="start"
                                            >
                                                <PopoverTrigger asChild>
                                                    <span className={`font-semibold text-sm truncate cursor-pointer hover:underline`}>
                                                        {getDisplayName(message.author_id)}
                                                    </span>
                                                </PopoverTrigger>
                                            </UserProfilePopover>

                                            <span
                                                className="text-xs text-muted-foreground whitespace-nowrap"
                                                title={formatFullDate(message.timestamp)}
                                            >
                                                {formatTimestamp(message.timestamp)}
                                            </span>

                                            {/* Add wallet address as tooltip/subtitle if we're showing a username */}
                                            {getUserProfileFromCache(message.author_id)?.username && (
                                                <span className="text-xs text-muted-foreground hidden group-hover:inline">
                                                    {message.author_id.substring(0, 6)}...{message.author_id.substring(message.author_id.length - 4)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm break-words">
                                            {formatMessageWithMentions(message.content)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-border/30">
                <form onSubmit={handleSendMessage} className="relative rounded-md">
                    <MentionsInput
                        value={messageInput}
                        onChange={handleMentionInputChange}
                        style={mentionsInputStyle}
                        placeholder={`Message #${activeChannel.name}`}
                        a11ySuggestionsListLabel={"Suggested mentions"}
                        className="w-full py-2 px-3 pr-10 bg-muted/50 rounded-md border-none focus:outline-none"
                        disabled={isSending}
                        singleLine
                        forceSuggestionsAboveCursor
                    >
                        <Mention
                            trigger="@"
                            data={getMembersData}
                            renderSuggestion={renderMemberSuggestion}
                            markup="@[__display__](__id__)"
                            displayTransform={(id, display) => `@${display}`}
                            appendSpaceOnAdd
                        />
                    </MentionsInput>
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        disabled={!messageInput.trim() || isSending}
                    >
                        {isSending ? (
                            <div className="h-4 w-4 opacity-70"></div>
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}