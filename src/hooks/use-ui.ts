import { create } from "zustand";

interface UIState {
    showUsers: boolean
    showSettings: boolean
    showFriends: boolean
    actions: UIActions
}

interface UIActions {
    setShowUsers: (showUsers: boolean) => void
    setShowSettings: (showSettings: boolean) => void
    setShowFriends: (showFriends: boolean) => void
}

export const useUI = create<UIState>()((set, get) => ({
    showUsers: true,
    showSettings: false,
    showFriends: false,
    actions: {
        setShowUsers: (showUsers: boolean) => set({ showUsers }),
        setShowSettings: (showSettings: boolean) => set({ showSettings }),
        setShowFriends: (showFriends: boolean) => set({ showFriends })
    }
}))