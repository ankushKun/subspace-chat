import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Server, type ServerMember } from "@/types/subspace";


interface ServerState {
    loadingServers: boolean;
    loadingServerMembers: boolean;
    loadingServerChannels: boolean;

    activeServerId: string;
    servers: Record<string, Server | null>; // ServerId -> Server

    actions: ServerActions;
}

interface ServerActions {
    setLoadingServers: (loading: boolean) => void;
    setLoadingServerMembers: (loading: boolean) => void;
    setLoadingServerChannels: (loading: boolean) => void;

    setActiveServerId: (serverId: string) => void;
    setServers: (servers: Record<string, Server>) => void;
    addServer: (server: Server) => void;
    removeServer: (serverId: string) => void;
    updateServer: (serverId: string, server: Server) => void;
    updateServerMembers: (serverId: string, members: ServerMember[]) => void;
    removeServerMember: (serverId: string, memberId: string) => void;
}



export const useServer = create<ServerState>()(persist((set, get) => ({
    // state
    loadingServers: false,
    loadingServerMembers: false,
    loadingServerChannels: false,

    activeServerId: "",
    servers: {},

    // actions
    actions: {
        setLoadingServers: (loading: boolean) => set({ loadingServers: loading }),
        setLoadingServerMembers: (loading: boolean) => set({ loadingServerMembers: loading }),
        setLoadingServerChannels: (loading: boolean) => set({ loadingServerChannels: loading }),

        setActiveServerId: (serverId: string) => set({ activeServerId: serverId }),
        setServers: (servers: Record<string, Server>) => set({ servers }),
        addServer: (server: Server) => set((state) => ({ servers: { ...state.servers, [server.serverId]: server } })),
        removeServer: (serverId: string) => set((state) => {
            delete state.servers[serverId];
            return state;
        }),
        updateServer: (serverId: string, server: Server) => set((state) => {
            state.servers[serverId] = server;
            return state;
        }),
        updateServerMembers: (serverId: string, members: ServerMember[]) => set((state) => {
            state.servers[serverId].members = members;
            return state;
        }),
        removeServerMember: (serverId: string, memberId: string) => set((state) => {
            delete state.servers[serverId].members[memberId];
            return state;
        })
    }
}), {
    name: "subspace-server-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        activeServerId: state.activeServerId,
        servers: state.servers,
    })
}))