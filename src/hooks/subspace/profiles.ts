import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Profile, type Friend } from "@/types/subspace";
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
    updateFriends: (userId: string, friends: Friend[]) => void;
    getFriends: (userId: string) => Friend[];
    isFriend: (userId1: string, userId2: string) => boolean;
    getFriendshipStatus: (userId1: string, userId2: string) => 'none' | 'pending_sent' | 'pending_received' | 'friends';
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
        updateProfile: (userId: string, profile: Profile) => set((state) => ({ profiles: { ...state.profiles, [userId]: { ...state.profiles[userId], ...profile } } })),
        updateFriends: (userId: string, friends: Friend[]) => set((state) => ({
            profiles: {
                ...state.profiles,
                [userId]: {
                    ...state.profiles[userId],
                    friends
                }
            }
        })),
        getFriends: (userId: string) => {
            const profile = get().profiles[userId];
            return profile?.friends || [];
        },
        isFriend: (userId1: string, userId2: string) => {
            const profile = get().profiles[userId1];
            if (!profile?.friends) return false;

            return profile.friends.some(friend =>
                ((friend.userId1 === userId1 && friend.userId2 === userId2) ||
                    (friend.userId1 === userId2 && friend.userId2 === userId1)) &&
                friend.user1Accepted === 1 && friend.user2Accepted === 1
            );
        },
        getFriendshipStatus: (userId1: string, userId2: string) => {
            const profile = get().profiles[userId1];
            if (!profile?.friends) return 'none';

            const friendship = profile.friends.find(friend =>
                (friend.userId1 === userId1 && friend.userId2 === userId2) ||
                (friend.userId1 === userId2 && friend.userId2 === userId1)
            );

            if (!friendship) return 'none';

            if (friendship.user1Accepted === 1 && friendship.user2Accepted === 1) {
                return 'friends';
            } else if (friendship.userId1 === userId1 && friendship.user2Accepted === 0) {
                return 'pending_sent';
            } else if (friendship.userId2 === userId1 && friendship.user2Accepted === 0) {
                return 'pending_received';
            }

            return 'none';
        }
    }
}), {
    name: "subspace-profile-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        profiles: state.profiles
    })
}))


