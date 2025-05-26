import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Profile } from "@/types/subspace";
import type { User } from "@/lib/subspace/user";


interface ProfileState {
    loadingProfile: boolean;
    profiles: Record<string, Profile>; // ProfileId -> Profile

    actions: ProfileActions;
}

interface ProfileActions {
    setLoadingProfile: (loading: boolean) => void;
    setProfiles: (profiles: Record<string, Profile>) => void;
    updateProfile: (userId: string, profile: Profile) => void;
}

export const useProfile = create<ProfileState>()(persist((set, get) => ({
    loadingProfile: false,
    profiles: {},
    actions: {
        setLoadingProfile: (loading: boolean) => set({ loadingProfile: loading }),
        setProfiles: (profiles: Record<string, Profile>) => set((state) => ({
            profiles: {
                ...state.profiles,
                ...Object.fromEntries(
                    Object.entries(profiles).map(([userId, profile]) => [
                        userId,
                        { ...state.profiles[userId], ...profile }
                    ])
                )
            }
        })),
        updateProfile: (userId: string, profile: Profile) => set((state) => ({ profiles: { ...state.profiles, [userId]: { ...state.profiles[userId], ...profile } } }))
    }
}), {
    name: "subspace-profile-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        profiles: state.profiles
    })
}))


