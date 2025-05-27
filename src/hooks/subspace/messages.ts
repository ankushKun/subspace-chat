import type { Message } from "@/types/subspace";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface MessagesState {
    loadingMessages: boolean;
    messages: Record<string, Record<number, Record<number, Message>>>; // serverId -> channelId -> messageId -> message

    actions: MessagesActions;
}

interface MessagesActions {
    setLoadingMessages: (loading: boolean) => void;
    setMessages: (serverId: string, channelId: number, messages: Message[]) => void;
    addMessage: (serverId: string, channelId: number, message: Message) => void;
    addMessages: (serverId: string, channelId: number, messages: Message[]) => void;
    removeMessage: (serverId: string, channelId: number, messageId: number) => void;
    updateMessage: (serverId: string, channelId: number, messageId: number, message: Message) => void;
    clearMessages: (serverId: string, channelId: number) => void;
    clearAllMessages: () => void;

    getLastMessageId: (serverId: string, channelId: number) => number | null;
}

export const useMessages = create<MessagesState>()(persist((set, get) => ({
    loadingMessages: false,
    messages: {},
    actions: {
        setLoadingMessages: (loading: boolean) => set({ loadingMessages: loading }),
        setMessages: (serverId: string, channelId: number, messages: Message[]) => set((state) => ({
            ...state,
            messages: {
                ...state.messages,
                [serverId]: {
                    ...state.messages[serverId],
                    [channelId]: messages.reduce((acc, message) => ({
                        ...acc,
                        [message.messageId]: message
                    }), {})
                }
            }
        })),
        addMessages: (serverId: string, channelId: number, messages: Message[]) => set((state) => ({
            ...state,
            messages: {
                ...state.messages,
                [serverId]: {
                    ...state.messages[serverId],
                    [channelId]: {
                        ...(state.messages[serverId]?.[channelId] || {}),
                        ...messages.reduce((acc, message) => ({
                            ...acc,
                            [message.messageId]: message
                        }), {})
                    }
                }
            }
        })),
        addMessage: (serverId: string, channelId: number, message: Message) => set((state) => ({
            ...state,
            messages: {
                ...state.messages,
                [serverId]: {
                    ...state.messages[serverId],
                    [channelId]: {
                        ...(state.messages[serverId]?.[channelId] || {}),
                        [message.messageId]: message
                    }
                }
            }
        })),
        removeMessage: (serverId: string, channelId: number, messageId: number) => set((state) => {
            const newChannelMessages = { ...(state.messages[serverId]?.[channelId] || {}) }
            delete newChannelMessages[messageId]
            return {
                ...state,
                messages: {
                    ...state.messages,
                    [serverId]: {
                        ...state.messages[serverId],
                        [channelId]: newChannelMessages
                    }
                }
            }
        }),
        updateMessage: (serverId: string, channelId: number, messageId: number, message: Message) => set((state) => ({
            ...state,
            messages: {
                ...state.messages,
                [serverId]: {
                    ...state.messages[serverId],
                    [channelId]: {
                        ...(state.messages[serverId]?.[channelId] || {}),
                        [messageId]: message
                    }
                }
            }
        })),
        clearMessages: (serverId: string, channelId: number) => set((state) => ({
            ...state,
            messages: {
                ...state.messages,
                [serverId]: {
                    ...state.messages[serverId],
                    [channelId]: {}
                }
            }
        })),
        clearAllMessages: () => set({ messages: {} }),

        getLastMessageId: (serverId: string, channelId: number) => {
            const state = get()
            if (!state.messages[serverId] || !state.messages[serverId][channelId]) return null
            const messageIds = Object.keys(state.messages[serverId][channelId]).map(Number)
            return messageIds.length > 0 ? Math.max(...messageIds) : null
        }
    }
}), {
    name: "subspace-messages",
    storage: createJSONStorage(() => localStorage),
    partialize: (state: MessagesState) => ({ messages: state.messages })
}))