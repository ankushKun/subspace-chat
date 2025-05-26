import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Server, type ServerMember } from "@/types/subspace";


interface ServerState {
    loadingServers: boolean;
    loadingServerMembers: boolean;
    loadingServerChannels: boolean;

    activeServerId: string;
    activeChannelId: number;
    serversJoined: Record<string, string[]>; // UserId -> ServerId[]
    servers: Record<string, Server | null>; // ServerId -> Server

    actions: ServerActions;
}

interface ServerActions {
    setLoadingServers: (loading: boolean) => void;
    setLoadingServerMembers: (loading: boolean) => void;
    setLoadingServerChannels: (loading: boolean) => void;

    setActiveServerId: (serverId: string) => void;
    setActiveChannelId: (channelId: number) => void;

    setServersJoined: (userId: string, servers: string[]) => void;

    setServers: (servers: Record<string, Server>) => void;
    addServer: (server: Server) => void;
    removeServer: (serverId: string) => void;
    updateServer: (serverId: string, server: Server) => void;
    updateServerMembers: (serverId: string, members: ServerMember[]) => void;
    removeServerMember: (serverId: string, memberId: string) => void;

    clearAllServers: () => void;
}



export const useServer = create<ServerState>()(persist((set, get) => ({
    // state
    loadingServers: false,
    loadingServerMembers: false,
    loadingServerChannels: false,

    activeServerId: "",
    activeChannelId: 0,
    servers: {},
    serversJoined: {},

    // actions
    actions: {
        setLoadingServers: (loading: boolean) => set({ loadingServers: loading }),
        setLoadingServerMembers: (loading: boolean) => set({ loadingServerMembers: loading }),
        setLoadingServerChannels: (loading: boolean) => set({ loadingServerChannels: loading }),

        setActiveServerId: (serverId: string) => set({ activeServerId: serverId }),
        setActiveChannelId: (channelId: number) => set({ activeChannelId: channelId }),

        setServersJoined(userId: string, servers: string[]) {
            set((state) => ({ serversJoined: { ...state.serversJoined, [userId]: servers } }))
        },

        setServers: (servers: Record<string, Server>) => set({ servers }),
        addServer: (server: Server) => set((state) => ({ servers: { ...state.servers, [server.serverId]: server } })),
        removeServer: (serverId: string) => set((state) => {
            const { [serverId]: removed, ...remainingServers } = state.servers;
            return { servers: remainingServers };
        }),
        updateServer: (serverId: string, server: Server) => set((state) => ({
            servers: {
                ...state.servers,
                [serverId]: {
                    ...state.servers[serverId],
                    ...server
                }
            }
        })),
        updateServerMembers: (serverId: string, members: ServerMember[]) => set((state) => {
            if (!state.servers[serverId]) {
                console.warn(`Attempted to update members for non-existent server: ${serverId}`);
                return state;
            }
            return {
                servers: {
                    ...state.servers,
                    [serverId]: {
                        ...state.servers[serverId],
                        members: members
                    }
                }
            };
        }),
        removeServerMember: (serverId: string, memberId: string) => set((state) => {
            if (!state.servers[serverId]) {
                console.warn(`Attempted to remove member from non-existent server: ${serverId}`);
                return state;
            }
            const updatedMembers = state.servers[serverId]?.members?.filter(member => member.userId !== memberId) || [];
            return {
                servers: {
                    ...state.servers,
                    [serverId]: {
                        ...state.servers[serverId],
                        members: updatedMembers
                    }
                }
            };
        }),

        clearAllServers: () => set({ servers: {} }),
    }
}), {
    name: "subspace-server-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        activeServerId: state.activeServerId,
        servers: state.servers,
        serversJoined: state.serversJoined,
    })
}))