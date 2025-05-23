import { useGlobalState } from "@/hooks/global-state";
import { ArrowLeft, HashIcon, Send, Users, Loader2, MoreVertical, Pencil, Trash2, Plus, Smile } from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { FormEvent } from "react";
import type { Channel } from "@/lib/types";
import { getMessages, sendMessage, editMessage, deleteMessage, markNotificationsAsRead } from "@/lib/ao";
import { toast } from "sonner";
import { useMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import UserProfilePopover from "./user-profile-popover";
import { PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MentionsInput, Mention } from 'react-mentions';
import EmojiPicker, { EmojiStyle, SkinTonePickerLocation, SuggestionMode } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { Theme as EmojiTheme } from 'emoji-picker-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FaInbox } from "react-icons/fa6";
import { BiSolidInbox } from "react-icons/bi";
import NotificationsPanel from "./notifications-panel";
import { getProfile, fetchBulkProfiles, warmupProfileCache } from "@/lib/profile-manager";
import { useWallet } from "@/hooks/use-wallet"
import { Portal } from "@radix-ui/react-portal";
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
        overflow: 'auto',
        padding: '0px 8px',
        height: '40px',
        borderRadius: '6px',
        border: 'none',
        outline: 'none',
    },
    suggestions: {
        backgroundColor: 'transparent',
        list: {
            maxHeight: '369px',
            minWidth: '300px',
            overflowY: 'scroll',
            width: '100%',
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

// Add cooldown tracking for force refreshes
const forceRefreshCooldowns = new Map<string, number>();
const FORCE_REFRESH_COOLDOWN = 30000; // 30 seconds between force refreshes

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
        // Still use the global state profile cache for compatibility
        userProfilesCache,
        getUserProfileFromCache,
        getServerMembers,
        fetchServerMembers,
        serverMembers
    } = useGlobalState();
    const isMobile = useMobile();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const previousChannelIdRef = useRef<number | null>(null);
    const activeUserProfilesRef = useRef<Set<string>>(new Set());
    const abortControllerRef = useRef<AbortController | null>(null);
    // State for editing messages
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [editedContent, setEditedContent] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    // Current user address
    const { address } = useWallet()
    // Add a state to track profile cache updates
    const [profileCacheVersion, setProfileCacheVersion] = useState(0);
    // Create a ref to track previous server ID for handling collapsing users panel
    const prevServerIdRef = useRef<string | null>(null);
    // Add new state for emoji picker
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Add function to ensure message author is in member list
    const ensureAuthorInMemberList = useCallback(async (authorId: string) => {
        if (!activeServerId) return;

        // Get current members
        const currentMembers = getServerMembers(activeServerId);
        if (!currentMembers) {
            // If we don't have members loaded, refresh the entire list
            await fetchServerMembers(activeServerId, true);
            return;
        }

        // Check if author is already in member list
        const isAuthorMember = currentMembers.some(member => member.id === authorId);
        if (!isAuthorMember) {
            console.log(`[Chat] Author ${authorId} not in member list, refreshing members`);
            // Do a background refresh to avoid disrupting the UI
            fetchServerMembers(activeServerId, true)
                .catch(error => console.warn('[Chat] Background member refresh failed:', error));
        }
    }, [activeServerId, getServerMembers, fetchServerMembers]);

    // Watch for profile changes that should trigger re-rendering of messages
    useEffect(() => {
        if (!messages || messages.length === 0) return;

        // Get all unique author IDs from messages
        const authorIds = Array.from(new Set(messages.map(m => m.author_id)));

        // Check each author is in member list
        authorIds.forEach(authorId => {
            ensureAuthorInMemberList(authorId);
        });

        // Check for profile updates every 5 seconds
        const profileUpdateTimer = setInterval(() => {
            // Get all unique author IDs from messages
            const authorIds = Array.from(new Set(messages.map(m => m.author_id)));

            // Check if any author profiles have been updated in the last 10 seconds
            const hasRecentProfileUpdates = authorIds.some(authorId => {
                const profile = getUserProfileFromCache(authorId);
                return profile && profile.timestamp > (Date.now() - 10000);
            });

            if (hasRecentProfileUpdates) {
                // Increment the profile cache version to force a re-render
                setProfileCacheVersion(v => v + 1);
            }
        }, 5000);

        return () => clearInterval(profileUpdateTimer);
    }, [messages, getUserProfileFromCache, ensureAuthorInMemberList]);

    // Find the active channel from the server data
    const activeChannel = useMemo(() => {
        if (!activeServer || activeChannelId === null) return null;
        return activeServer.channels.find(channel => channel.id === activeChannelId) || null;
    }, [activeServer, activeChannelId]);

    // Collapse users panel when server changes
    useEffect(() => {
        // Only collapse if the server has actually changed (not on first mount)
        if (prevServerIdRef.current !== activeServerId && activeServerId !== null) {
            // Only collapse if this isn't the initial render
            if (prevServerIdRef.current !== null) {
                console.log('[Chat] Server changed, collapsing users panel');
                setShowUsers(false);
            }

            // Update the ref for the next change
            prevServerIdRef.current = activeServerId;
        }
    }, [activeServerId, setShowUsers]);

    // Handle channel changes
    useEffect(() => {
        // Create an async function inside the effect
        const handleChannelChange = async () => {
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
                    } else {
                        // No cached messages found - keep messages empty
                        setMessages([]);
                        // Load silently in background with no indicator
                        setIsLoadingMessages(false);
                    }

                    // Mark notifications as read when channel becomes active
                    if (activeServerId) {
                        try {
                            console.log(`[Chat] Marking notifications as read for channel ${activeChannelId} in server ${activeServerId}`);
                            const markReadResult = await markNotificationsAsRead(activeServerId, activeChannelId);
                            console.log(`[Chat] Successfully marked notifications as read`, markReadResult);
                        } catch (error) {
                            console.warn(`[Chat] Error marking notifications as read:`, error);
                        }
                    }
                }
            }
        };

        // Call the async function
        handleChannelChange();

        // Clean up any aborted fetch when channel changes
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [activeServerId, activeChannelId, getChannelMessages]);

    // Handle scroll events to determine if user is at bottom
    useEffect(() => {
        const handleScroll = () => {
            if (!chatContainerRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            // Consider "at bottom" if within 100px of the bottom
            const atBottom = scrollHeight - scrollTop - clientHeight < 100;
            setIsAtBottom(atBottom);
        };

        const chatContainer = chatContainerRef.current;
        if (chatContainer) {
            chatContainer.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (chatContainer) {
                chatContainer.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    // Auto-scroll to bottom when messages change, but only if user is at bottom already
    useEffect(() => {
        if (isAtBottom) {
            scrollToBottom();
        }
    }, [messages, isAtBottom]);

    // Optimize profile loading for message authors
    useEffect(() => {
        if (!activeServerId || !messages || messages.length === 0) return;

        // Extract unique author IDs from messages
        const uniqueAuthorIds = Array.from(new Set(messages.map(m => m.author_id)));

        // Skip authors we've already loaded (check against activeUserProfilesRef)
        const authorsToLoad = uniqueAuthorIds.filter(
            authorId => !activeUserProfilesRef.current.has(authorId)
        );

        if (authorsToLoad.length === 0) return;

        // Mark these authors as being loaded
        authorsToLoad.forEach(id => activeUserProfilesRef.current.add(id));

        // Use our ProfileManager to bulk load and warm cache
        warmupProfileCache(authorsToLoad);

        console.log(`[Chat] Optimized profile loading for ${authorsToLoad.length} message authors`);
    }, [messages, activeServerId]);

    // Fetch messages with rate limiting and smart caching
    const fetchMessages = async (showLoading = false) => {
        if (!activeServerId || !activeChannelId) return;

        // Prevent multiple concurrent fetches
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

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

                        // Load profiles for message authors in bulk using ProfileManager
                        if (sortedMessages.length > 0) {
                            const uniqueAuthors = Array.from(
                                new Set(sortedMessages.map(msg => msg.author_id))
                            );

                            // Skip profiles we've already loaded
                            const authorsToLoad = uniqueAuthors.filter(authorId =>
                                !activeUserProfilesRef.current.has(authorId)
                            );

                            // Mark these as loaded
                            authorsToLoad.forEach(id => activeUserProfilesRef.current.add(id));

                            // Use the ProfileManager to warm up the cache
                            if (authorsToLoad.length > 0) {
                                warmupProfileCache(authorsToLoad);
                                console.log(`[Chat] Queued profile loading for ${authorsToLoad.length} new message authors`);
                            }
                        }
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
            abortControllerRef.current = null;
        }
    };

    // Smart polling with backoff
    useEffect(() => {
        if (!activeServerId || !activeChannelId) return;

        let pollInterval = 5000; // Start with 5 seconds
        let consecutiveErrors = 0;

        const poll = async () => {
            try {
                await fetchMessages(false);
                consecutiveErrors = 0;
                pollInterval = 5000; // Reset to base interval after success
            } catch (error) {
                consecutiveErrors++;
                // Exponential backoff with max of 30 seconds
                pollInterval = Math.min(30000, pollInterval * (1 + 0.5 * consecutiveErrors));
                console.warn(`Message polling error, backing off to ${pollInterval}ms`, error);
            }
        };

        // Initial fetch
        poll();

        // Set up polling with dynamic interval
        const intervalId = setInterval(poll, pollInterval);

        return () => {
            clearInterval(intervalId);
            // Clear abort controller when unmounting
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            // Clear messages when unmounting this channel
            if (previousChannelIdRef.current === activeChannelId) {
                previousChannelIdRef.current = null;
            }
        };
    }, [activeServerId, activeChannelId]);

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
                author_id: address,
                msg_id: `optimistic-${Date.now()}`, // Temporary message ID
                timestamp: Math.floor(Date.now() / 1000),
                edited: 0
            };

            // Update UI immediately with optimistic message
            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
            setMessageInput("");

            // Always scroll to bottom when user sends a message
            scrollToBottom();
            // Also update isAtBottom state since we're at bottom now
            setIsAtBottom(true);

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

    // Get display name for a user with enhanced profile data
    const getDisplayName = (userId: string) => {
        // First try to get nickname from server members
        const members = getServerMembers(activeServerId || "");
        if (members) {
            const member = members.find(m => m.id === userId);
            if (member && member.nickname) {
                return member.nickname;
            }
        }

        // Check profile cache from global state for compatibility with rest of app
        const profileData = getUserProfileFromCache(userId);

        // Use primaryName if available
        if (profileData?.primaryName) {
            return profileData.primaryName;
        }

        // Use username if available
        if (profileData?.username) {
            return profileData.username;
        }

        // Fall back to wallet address
        return `${userId.substring(0, 6)}...${userId.substring(userId.length - 4)}`;
    };

    // Get profile picture for a user - use global state for compatibility
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
        if (!members) {
            callback([]);
            return;
        }

        // Get unique message authors
        const messageAuthors = Array.from(new Set(messages.map(m => m.author_id)));

        // Create a Set to track unique IDs we've processed
        const processedIds = new Set<string>();

        // Process server members first
        const suggestions = members
            .filter(member => {
                const displayName = getDisplayName(member.id);
                processedIds.add(member.id);
                return displayName.toLowerCase().includes(query.toLowerCase());
            })
            .map(member => {
                const displayName = getDisplayName(member.id);
                return {
                    id: member.id,
                    display: displayName,
                    source: 'member'
                };
            });

        // Add message authors that aren't in the members list
        const additionalAuthors = messageAuthors
            .filter(authorId => {
                if (processedIds.has(authorId)) return false;
                const displayName = getDisplayName(authorId);
                return displayName.toLowerCase().includes(query.toLowerCase());
            })
            .map(authorId => {
                const displayName = getDisplayName(authorId);
                return {
                    id: authorId,
                    display: displayName,
                    source: 'author'
                };
            });

        // Combine and sort the results
        const combinedResults = [...suggestions, ...additionalAuthors].sort((a, b) => {
            // Sort by display name
            return a.display.localeCompare(b.display);
        });

        callback(combinedResults);
    };

    // Custom renderer for the mention suggestions
    const renderMemberSuggestion = (
        suggestion: { id: string; display: string; source: string },
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
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            {suggestion.id.substring(0, 6)}...{suggestion.id.substring(suggestion.id.length - 4)}
                        </span>
                        {suggestion.source === 'author' && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                                Recent
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Function to get channels data for mentions
    const getChannelsData = (query: string, callback: (data: any[]) => void) => {
        if (!activeServer) {
            callback([]);
            return;
        }

        // Filter and format channels for the mentions component
        const filteredChannels = activeServer.channels
            .filter(channel => channel.name.toLowerCase().includes(query.toLowerCase()))
            .map(channel => ({
                id: channel.id.toString(),
                display: channel.name,
                category_id: channel.category_id
            }));

        callback(filteredChannels);
    };

    // Custom renderer for the channel suggestions
    const renderChannelSuggestion = (
        suggestion: { id: string; display: string; category_id: number | null },
        search: string,
        highlightedDisplay: React.ReactNode,
        index: number,
        focused: boolean
    ) => {
        // Find category name if channel belongs to one
        let categoryName = "";
        if (suggestion.category_id !== null && activeServer) {
            const category = activeServer.categories.find(c => c.id === suggestion.category_id);
            if (category) {
                categoryName = category.name;
            }
        }

        return (
            <div className={`flex items-center gap-3 py-1.5 px-2 ${focused ? 'bg-accent/20' : ''} hover:bg-accent/10 transition-colors`}>
                <div className="w-8 h-8 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                    <HashIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-foreground">{highlightedDisplay}</span>
                    {categoryName && (
                        <span className="text-xs text-muted-foreground">
                            in {categoryName}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    // Generate placeholder messages for empty state or loading state
    const renderPlaceholderMessages = () => (
        <div className="space-y-4 p-4">
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

    // Function to check if a message contains only emojis and count them
    const isEmojiOnlyMessage = (content: string) => {
        // Regex to match emoji characters
        const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

        // Remove all emoji characters
        const withoutEmoji = content.replace(emojiRegex, '').trim();

        // If there's any text left after removing emojis, it's not emoji-only
        if (withoutEmoji.length > 0) return false;

        // Count emojis
        const emojiCount = (content.match(emojiRegex) || []).length;

        // Return true if it's only emojis and count is 5 or less
        return emojiCount > 0 && emojiCount <= 5;
    };

    // Format message with mentions and markdown
    const formatMessageWithMentions = (content: string) => {
        // Check if it's an emoji-only message first
        if (isEmojiOnlyMessage(content)) {
            return <span className="text-4xl leading-normal">{content}</span>;
        }

        // Process mentions first
        const mentions: { type: 'user' | 'channel'; display: string; id: string; }[] = [];
        let processedContent = content;

        // Extract and store mentions
        const userMentionRegex = /@\[(.*?)\]\((.*?)\)/g;
        const channelMentionRegex = /#\[(.*?)\]\((.*?)\)/g;

        // Replace mentions with special markdown links that we can style
        processedContent = processedContent.replace(userMentionRegex, (match, display, id) => {
            const index = mentions.length;
            mentions.push({ type: 'user', display, id });
            return `[${display}](#__user_mention_${index}__)`;
        });

        processedContent = processedContent.replace(channelMentionRegex, (match, display, id) => {
            const index = mentions.length;
            mentions.push({ type: 'channel', display, id });
            return `[${display}](#__channel_mention_${index}__)`;
        });

        // Custom components for markdown rendering
        const components = {
            // Handle links specially to detect our mention placeholders
            a: (props: { href?: string; children: React.ReactNode }) => {
                const { href, children } = props;

                // User mention
                if (href?.startsWith('#__user_mention_')) {
                    const index = parseInt(href.replace('#__user_mention_', '').replace('__', ''));
                    const mention = mentions[index];
                    if (!mention) return <>{children}</>;

                    return (
                        <UserProfilePopover key={`mention-${index}`} userId={mention.id} side="top" align="center">
                            <PopoverTrigger asChild>
                                <span className="bg-indigo-400/40 dark:bg-indigo-600/40 hover:bg-indigo-400/60 dark:hover:bg-indigo-600/60 px-1 py-0.5 rounded cursor-pointer transition-colors duration-200 text-white">
                                    @{mention.display}
                                </span>
                            </PopoverTrigger>
                        </UserProfilePopover>
                    );
                }

                // Channel mention
                if (href?.startsWith('#__channel_mention_')) {
                    const index = parseInt(href.replace('#__channel_mention_', '').replace('__', ''));
                    const mention = mentions[index];
                    if (!mention) return <>{children}</>;

                    const channel = activeServer?.channels.find(ch => ch.id.toString() === mention.id);
                    const categoryName = channel?.category_id !== null && activeServer
                        ? activeServer.categories.find(c => c.id === channel?.category_id)?.name
                        : null;

                    return (
                        <span
                            key={`channel-mention-${index}`}
                            className="bg-indigo-400/40 dark:bg-indigo-600/40 hover:bg-indigo-400/60 dark:hover:bg-indigo-600/60 px-1 py-0.5 rounded cursor-pointer transition-colors duration-200 text-white"
                            title={categoryName ? `#${mention.display} in ${categoryName}` : `#${mention.display}`}
                            onClick={() => {
                                if (channel) {
                                    navigate(`/app/${activeServerId}/${channel.id}`);
                                }
                            }}
                        >
                            #{mention.display}
                        </span>
                    );
                }

                // Default to a normal link with confirmation
                return (
                    <a
                        href={href}
                        onClick={(e) => {
                            e.preventDefault();
                            toast.warning("Open external link?", {
                                richColors: true,
                                position: "top-center",
                                description: href,
                                action: {
                                    label: "Open",
                                    onClick: () => window.open(href, "_blank", "noopener,noreferrer")
                                },
                                cancel: {
                                    label: "Cancel",
                                    onClick: () => { /* Do nothing */ }
                                },
                                duration: 10000 // 10 seconds to give time to read
                            });
                        }}
                        className="text-blue-500 hover:underline"
                    >
                        {children}
                    </a>
                );
            },
            // Style other markdown elements
            p: ({ children }: { children: React.ReactNode }) => <p className="my-0">{children}</p>,
            h1: ({ children }: { children: React.ReactNode }) => <h1 className="text-4xl font-bold my-2">{children}</h1>,
            h2: ({ children }: { children: React.ReactNode }) => <h2 className="text-3xl font-bold my-2">{children}</h2>,
            h3: ({ children }: { children: React.ReactNode }) => <h3 className="text-2xl font-bold my-1">{children}</h3>,
            ul: ({ children }: { children: React.ReactNode }) => <ul className="list-disc ml-4 my-1">{children}</ul>,
            ol: ({ children }: { children: React.ReactNode }) => <ol className="list-decimal ml-4 my-1">{children}</ol>,
            li: ({ children }: { children: React.ReactNode }) => <li className="my-0.5">{children}</li>,
            code: ({ children }: { children: React.ReactNode }) => <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
            pre: ({ children }: { children: React.ReactNode }) => <pre className="bg-muted p-2 rounded my-2 overflow-x-auto">{children}</pre>,
            blockquote: ({ children }: { children: React.ReactNode }) => <blockquote className="border-l-2 border-muted-foreground pl-4 my-2 italic">{children}</blockquote>,
            img: ({ src, alt }: { src?: string; alt?: string }) => <p>{alt}</p>,
            // img: ({ src, alt }: { src?: string; alt?: string }) => {
            //     const [showPreview, setShowPreview] = useState(false);
            //     return (
            //         <AlertDialog open={showPreview} onOpenChange={setShowPreview}>
            //             <AlertDialogTrigger asChild>
            //                 <img
            //                     draggable={false}
            //                     src={src}
            //                     alt={alt}
            //                     className="max-w-min max-h-40 rounded my-2 hover:opacity-90 transition-opacity cursor-zoom-in"
            //                 />
            //             </AlertDialogTrigger>
            //             <AlertDialogContent className="min-w-[100vw] max-w-[100vw] backdrop-blur-xs min-h-[100vh] bg-transparent max-h-[100vh] p-0 border-border/30 overflow-hidden">
            //                 <AlertDialogCancel className="flex flex-col items-center justify-center w-auto h-auto bg-transparent">
            //                     <img
            //                         src={src}
            //                         alt={alt}
            //                         className="max-w-[90vw] max-h-[90vh] block rounded-md"
            //                         style={{ objectFit: "contain" }}
            //                     />
            //                     {alt && <p className="text-sm text-muted-foreground text-center">{alt}</p>}
            //                 </AlertDialogCancel>
            //             </AlertDialogContent>
            //         </AlertDialog>
            //     );
            // },
            hr: () => <hr className="my-4 border-muted" />,
            table: ({ children }: { children: React.ReactNode }) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-border">{children}</table></div>,
            th: ({ children }: { children: React.ReactNode }) => <th className="px-3 py-2 text-left text-sm font-semibold bg-muted">{children}</th>,
            td: ({ children }: { children: React.ReactNode }) => <td className="px-3 py-2 text-sm">{children}</td>,
        };

        return (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {processedContent}
                </ReactMarkdown>
            </div>
        );
    };

    // Handle edit message
    const handleEditMessage = async () => {
        if (!editingMessage || !editedContent.trim() || !activeServerId) {
            return;
        }

        setIsEditing(true);

        try {
            // Create an optimistic update
            const updatedMessages = messages.map(msg =>
                msg.msg_id === editingMessage.msg_id
                    ? { ...msg, content: editedContent.trim(), edited: 1 }
                    : msg
            );

            setMessages(updatedMessages);

            // Send the edit to the server
            await editMessage(
                activeServerId,
                editingMessage.msg_id,
                editedContent.trim()
            );

            // Fetch updated messages after a small delay
            setTimeout(() => fetchMessages(false), 500);

            // Exit edit mode
            setEditingMessage(null);
            setEditedContent("");
        } catch (error) {
            console.error("Error editing message:", error);
            toast.error("Failed to edit message");

            // Revert to original messages if editing failed
            fetchMessages(false);
        } finally {
            setIsEditing(false);
        }
    };

    // Handle delete message
    const handleDeleteMessage = async (message: Message) => {
        if (!activeServerId) return;

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
        });
    };

    // Actually perform the message deletion after confirmation
    const performMessageDeletion = async (message: Message) => {
        if (!activeServerId) return;

        setIsDeleting(true);

        try {
            // Optimistically remove the message from UI
            setMessages(messages.filter(msg => msg.msg_id !== message.msg_id));

            // Send delete request to server
            await deleteMessage(activeServerId, message.msg_id);

            // Fetch updated messages after a small delay
            setTimeout(() => fetchMessages(false), 500);
        } catch (error) {
            console.error("Error deleting message:", error);
            toast.error("Failed to delete message");

            // Refresh messages if deletion failed
            fetchMessages(false);
        } finally {
            setIsDeleting(false);
        }
    };

    // Cancel editing
    const cancelEditing = () => {
        setEditingMessage(null);
        setEditedContent("");
    };

    // Check if user is the author of a message
    const isMessageAuthor = async (authorId: string) => {
        try {
            const currentAddress = address;
            return currentAddress === authorId;
        } catch (error) {
            console.error("Error checking message author:", error);
            return false;
        }
    };

    // Check if the current user is the server owner
    const isServerOwner = useMemo(() => {
        if (!activeServer || !address) return false;
        return activeServer.owner === address;
    }, [activeServer, address]);

    // Show delete button if user is either the message author or the server owner
    const canDeleteMessage = (messageAuthorId: string) => {
        return messageAuthorId === address || isServerOwner;
    };

    // Check if a message mentions the current user
    const messageContainsCurrentUserMention = (content: string) => {
        if (!content || !address) return false;

        // Check for mentions in the format @[display](id) where id matches current address
        const mentionRegex = new RegExp(`@\\[.*?\\]\\(${address}\\)`, 'g');
        return mentionRegex.test(content);
    };

    // Add emoji click handler
    const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
        const emoji = emojiData.emoji;
        setMessageInput((prev) => {
            const cursorPosition = (document.activeElement as HTMLTextAreaElement)?.selectionStart || prev.length;
            const newMessageInput = prev.slice(0, cursorPosition) + emoji + prev.slice(cursorPosition);
            // setShowEmojiPicker(false);
            return newMessageInput;
        });
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
                <div className="absolute top-4 right-4 flex ">
                    <NotificationsPanel />
                </div>
                <div className="text-lg text-center">Select a channel to start chatting</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col">
            {/* Channel Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border/30 h-14">
                {isMobile && <Button variant="ghost" size="icon" className="!p-0 -ml-1" onClick={() => navigate(`/app/${activeServerId}`, { replace: false })}>
                    <ArrowLeft size={20} className="!h-5 !w-5 text-muted-foreground" />
                </Button>}
                <HashIcon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{activeChannel?.name}</span>
                <div className="grow" />
                <NotificationsPanel />
                {(activeServer?.member_count > 0 || showUsers) && (
                    <Button variant="ghost" size="icon" data-state={showUsers ? "active" : "inactive"}
                        className="!p-0 data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                        onClick={() => {
                            // Toggle users panel visibility
                            setShowUsers(!showUsers);

                            // If we're opening the panel and it's been a while since last refresh,
                            // do a background refresh
                            if (!showUsers && activeServerId) {
                                const lastRefresh = forceRefreshCooldowns?.get(activeServerId);
                                const now = Date.now();
                                if (!lastRefresh || (now - lastRefresh) > FORCE_REFRESH_COOLDOWN) {
                                    console.log(`[Chat] Background refreshing members for ${activeServerId}`);
                                    fetchServerMembers(activeServerId, true)
                                        .catch(error => console.warn('[Chat] Background member refresh failed:', error));
                                }
                            }
                        }}>
                        <Users size={20} className="!h-5 !w-5" />
                    </Button>
                )}
            </div>

            {/* Chat Content Area */}
            <div className="flex-1 overflow-y-auto flex flex-col relative" ref={chatContainerRef}>
                {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col justify-center items-center">
                        {isLoadingMessages ? (
                            renderPlaceholderMessages()
                        ) : (
                            <div className="text-center p-6">
                                <div className="mb-4 text-muted-foreground text-7xl flex justify-center">
                                    <HashIcon className="w-16 h-16 opacity-30" />
                                </div>
                                <h3 className="text-xl font-medium mb-2">Welcome to #{activeChannel?.name}</h3>
                                <p className="text-muted-foreground mb-6">
                                    This is the beginning of the channel. Be the first one to send a message!
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 mt-5">
                        {messages.map((message, index) => {
                            // Check if the message mentions the current user
                            const isCurrentUserMentioned = messageContainsCurrentUserMention(message.content);

                            return (
                                <div
                                    key={message.msg_id}
                                    className={`group relative px-4 py-1 pb-2 m-0 mb-1 hover:bg-foreground/5 ${isCurrentUserMentioned ? 'bg-yellow-400/10 border-l-2 border-yellow-400' : ''
                                        }`}
                                >

                                    {/* Message actions - direct buttons instead of dropdown */}
                                    <div className="ml-auto absolute -top-3 right-2 !h-fit !w-fit z-10 bottom-4 bg-accent/40 border border-accent/50 rounded-md backdrop-blur p-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        {message.author_id === address && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => {
                                                    setEditingMessage(message);
                                                    setEditedContent(message.content);
                                                }}
                                                disabled={isEditing || isDeleting}
                                                title="Edit message"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {canDeleteMessage(message.author_id) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={() => handleDeleteMessage(message)}
                                                disabled={isEditing || isDeleting}
                                                title={isServerOwner && message.author_id !== address ? "Delete as server owner" : "Delete message"}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="flex items-start gap-3">
                                        {/* Profile avatar - wrapped in the popover */}
                                        {/* @ts-ignore */}
                                        {messages[index - 1]?.author_id !== message.author_id ? <UserProfilePopover
                                            userId={message.author_id}
                                            side="right"
                                            align="start"
                                        >
                                            <PopoverTrigger asChild>
                                                <div className="w-10 h-10 mt-1 rounded-full bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer">
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
                                        </UserProfilePopover> : <div className="w-10"></div>}
                                        <div className="flex-1 min-w-0">
                                            {messages[index - 1]?.author_id !== message.author_id && <div
                                                data-collapse={messages[index - 1]?.author_id === message.author_id}
                                                className="flex items-center data-[collapse=true]:hidden h-6 gap-2">
                                                {/* Username with popover */}
                                                {/* @ts-ignore */}
                                                {messages[index - 1]?.author_id !== message.author_id && <UserProfilePopover
                                                    userId={message.author_id}
                                                    side="bottom"
                                                    align="start"
                                                >
                                                    <PopoverTrigger asChild>
                                                        {(() => {
                                                            const displayName = getDisplayName(message.author_id);
                                                            const userProfile = getUserProfileFromCache(message.author_id);
                                                            const hasNicknameOrPrimary = userProfile?.username || userProfile?.primaryName;
                                                            return (
                                                                <span
                                                                    className={`font-semibold text-sm truncate cursor-pointer hover:underline${!hasNicknameOrPrimary ? " text-muted-foreground" : ""}`}
                                                                >
                                                                    {displayName}
                                                                </span>
                                                            );
                                                        })()}
                                                    </PopoverTrigger>
                                                </UserProfilePopover>}

                                                {message.author_id !== messages[index - 1]?.author_id && <span
                                                    className="text-xs text-muted-foreground whitespace-nowrap"
                                                    title={message.edited
                                                        ? `${formatFullDate(message.timestamp)} (edited)`
                                                        : formatFullDate(message.timestamp)}
                                                >
                                                    {formatTimestamp(message.timestamp)}
                                                    {message.edited ?
                                                        <span className="text-xs ml-1 text-muted-foreground/80 italic" title="This message has been edited">
                                                            (edited)
                                                        </span> :
                                                        null}
                                                </span>}

                                                {/* Add wallet address as tooltip/subtitle if we're showing a username or primary name */}
                                                {message.author_id !== messages[index - 1]?.author_id && ((getUserProfileFromCache(message.author_id)?.username || getUserProfileFromCache(message.author_id)?.primaryName)) && (
                                                    <span className="text-xs text-muted-foreground hidden group-hover:inline">
                                                        {message.author_id.substring(0, 6)}...{message.author_id.substring(message.author_id.length - 4)}
                                                    </span>
                                                )}


                                            </div>}

                                            {/* Show edit input if editing this message */}
                                            {editingMessage?.msg_id === message.msg_id ? (
                                                <div className="mt-1">
                                                    <div className="flex gap-2 mt-2">
                                                        <Input
                                                            type="text"
                                                            value={editedContent}
                                                            onChange={(e) => setEditedContent(e.target.value)}
                                                            className="w-full p-2 text-sm bg-muted/50 rounded-md"
                                                            autoFocus
                                                        />
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={handleEditMessage}
                                                            disabled={isEditing}
                                                        >
                                                            {isEditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={cancelEditing}
                                                            disabled={isEditing}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className=" text-sm break-words">
                                                    {formatMessageWithMentions(message.content)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="rounded-md p-2 border-t flex rounded-t-none border-border/30 overflow-visible justify-between items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    data-state={showEmojiPicker ? "active" : "inactive"}
                    className="flex items-center justify-center data-[state=active]:bg-muted data-[state=inactive]:text-muted-foreground"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                    <Smile className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="flex items-center justify-center"
                    onClick={() => toast.info("coming soon", { position: "bottom-left" })}
                >
                    <Plus className="h-4 w-4" />
                </Button>
                <EmojiPicker
                    open={showEmojiPicker}
                    onEmojiClick={onEmojiClick}
                    autoFocusSearch={false}
                    className="!absolute bottom-18 -translate-x-[2px]"
                    theme={document.documentElement.classList.contains('dark') ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                    searchPlaceholder="Search emoji..."
                    skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                    emojiStyle={EmojiStyle.TWITTER}
                    suggestedEmojisMode={SuggestionMode.FREQUENT}
                />
                <MentionsInput
                    value={messageInput}
                    onChange={handleMentionInputChange}
                    // @ts-expect-error
                    style={mentionsInputStyle}
                    placeholder={`Message #${activeChannel.name}`}
                    a11ySuggestionsListLabel={"Suggested mentions"}
                    className="w-full py-2 bg-muted/50 rounded-md overflow-visible px-2 block max-w-[calc(100%-2.3rem)]"
                    disabled={isSending}
                    singleLine={true}
                    forceSuggestionsAboveCursor
                    autoFocus
                >
                    <Mention
                        trigger="@"
                        data={getMembersData}
                        renderSuggestion={renderMemberSuggestion}
                        markup="@[__display__](__id__)"
                        className="bg-indigo-400/40 dark:bg-indigo-600/40 hover:bg-indigo-400/60 dark:hover:bg-indigo-600/60 rounded relative -left-[1px] text-white bottom-[1px] p-0 m-0"
                        displayTransform={(id, display) => `@${display}`}
                        appendSpaceOnAdd
                    />
                    <Mention
                        trigger="#"
                        data={getChannelsData}
                        renderSuggestion={renderChannelSuggestion}
                        markup="#[__display__](__id__)"
                        className="bg-indigo-400/40 dark:bg-indigo-600/40 hover:bg-indigo-400/60 dark:hover:bg-indigo-600/60 rounded relative -left-[1px] text-white bottom-[1px] p-0 m-0"
                        displayTransform={(id, display) => `#${display}`}
                        appendSpaceOnAdd
                    />
                </MentionsInput>
                <Button
                    variant="ghost"
                    size="icon"
                    type="submit"
                    className="flex items-center justify-center"
                    disabled={!messageInput.trim() || isSending}
                >
                    {isSending ? (
                        <div className="h-4 w-4 opacity-70"></div>
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </form>
        </div>
    );
}