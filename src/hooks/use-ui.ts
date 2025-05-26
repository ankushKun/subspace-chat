import { create } from "zustand";

interface UIState {
    showUsers: boolean
    showSettings: boolean

    actions: UIActions
}

interface UIActions {
    setShowUsers: (showUsers: boolean) => void
    setShowSettings: (showSettings: boolean) => void
}

export const useUI = create<UIState>()((set, get) => ({
    showUsers: true,
    showSettings: false,
    actions: {
        setShowUsers: (showUsers: boolean) => set({ showUsers }),
        setShowSettings: (showSettings: boolean) => set({ showSettings })
    }
}))