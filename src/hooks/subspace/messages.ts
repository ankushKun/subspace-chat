import type { Message } from "@/types/subspace";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface MessagesState {
    messages: Record<string, Record<number, Record<number, Message>>>; // serverId -> channelId -> messageId -> message

    actions: MessagesActions;
}

interface MessagesActions {
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
    messages: {},
    actions: {
        setMessages: (serverId: string, channelId: number, messages: Message[]) => set((state) => {
            if (!state.messages) state.messages = {}
            if (!state.messages[serverId]) state.messages[serverId] = {}
            if (!state.messages[serverId][channelId]) state.messages[serverId][channelId] = {}
            state.messages[serverId][channelId] = messages.reduce((acc, message) => ({
                ...acc,
                [message.messageId]: message
            }), {})
            return state
        }),
        addMessages: (serverId: string, channelId: number, messages: Message[]) => set((state) => {
            if (!state.messages) state.messages = {}
            if (!state.messages[serverId]) state.messages[serverId] = {}
            if (!state.messages[serverId][channelId]) state.messages[serverId][channelId] = {}
            state.messages[serverId][channelId] = {
                ...state.messages[serverId][channelId],
                ...messages.reduce((acc, message) => ({
                    ...acc,
                    [message.messageId]: message
                }), {})
            }
            return state
        }),
        addMessage: (serverId: string, channelId: number, message: Message) => set((state) => {
            if (!state.messages) state.messages = {}
            if (!state.messages[serverId]) state.messages[serverId] = {}
            if (!state.messages[serverId][channelId]) state.messages[serverId][channelId] = {}
            state.messages[serverId][channelId][message.messageId] = message
            return state
        }),
        removeMessage: (serverId: string, channelId: number, messageId: number) => set((state) => {
            delete state.messages[serverId][channelId][messageId]
            return state
        }),
        updateMessage: (serverId: string, channelId: number, messageId: number, message: Message) => set((state) => {
            state.messages[serverId][channelId][messageId] = message
            return state
        }),
        clearMessages: (serverId: string, channelId: number) => set((state) => {
            if (!state.messages) state.messages = {}
            if (!state.messages[serverId]) state.messages[serverId] = {}
            if (!state.messages[serverId][channelId]) state.messages[serverId][channelId] = {}
            state.messages[serverId][channelId] = {}
            return state
        }),
        clearAllMessages: () => set({ messages: {} }),

        getLastMessageId: (serverId: string, channelId: number) => {
            if (!get().messages[serverId] || !get().messages[serverId][channelId]) return null
            return Math.max(...Object.keys(get().messages[serverId][channelId]).map(Number))
        }
    }
}), {
    name: "subspace-messages",
    storage: createJSONStorage(() => localStorage),
    partialize: (state: MessagesState) => ({ messages: state.messages })
}))