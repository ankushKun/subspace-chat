import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Server, type ServerMember } from "@/types/subspace";


interface ServerState {
    loadingServers: boolean;
    loadingServerMembers: boolean;
    loadingServerChannels: boolean;

    activeServerId: string;
    activeChannelId: number;
    lastActiveChannelByServer: Record<string, number>; // ServerId -> ChannelId
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
    setActiveServerIdAndRestoreChannel: (serverId: string) => void;

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
    lastActiveChannelByServer: {},
    servers: {},
    serversJoined: {},

    // actions
    actions: {
        setLoadingServers: (loading: boolean) => set({ loadingServers: loading }),
        setLoadingServerMembers: (loading: boolean) => set({ loadingServerMembers: loading }),
        setLoadingServerChannels: (loading: boolean) => set({ loadingServerChannels: loading }),

        setActiveServerId: (serverId: string) => {
            const state = get();

            // Store the current active channel for the previous server
            if (state.activeServerId && state.activeChannelId > 0) {
                set((prevState) => ({
                    lastActiveChannelByServer: {
                        ...prevState.lastActiveChannelByServer,
                        [state.activeServerId]: state.activeChannelId
                    }
                }));
            }

            set({ activeServerId: serverId, activeChannelId: 0 });
        },

        setActiveChannelId: (channelId: number) => {
            const state = get();

            // Store the channel as the last active for the current server
            if (state.activeServerId && channelId > 0) {
                set((prevState) => ({
                    activeChannelId: channelId,
                    lastActiveChannelByServer: {
                        ...prevState.lastActiveChannelByServer,
                        [state.activeServerId]: channelId
                    }
                }));
            } else {
                set({ activeChannelId: channelId });
            }
        },

        setActiveServerIdAndRestoreChannel: (serverId: string) => {
            const state = get();

            // Store the current active channel for the previous server
            if (state.activeServerId && state.activeChannelId > 0) {
                set((prevState) => ({
                    lastActiveChannelByServer: {
                        ...prevState.lastActiveChannelByServer,
                        [state.activeServerId]: state.activeChannelId
                    }
                }));
            }

            // Get the last active channel for the new server
            const lastChannelId = state.lastActiveChannelByServer[serverId];
            let channelIdToSet = 0;

            // Check if the last channel still exists in the server
            if (lastChannelId && state.servers[serverId]) {
                const server = state.servers[serverId];
                const channelExists = server?.channels?.some(channel => channel.channelId === lastChannelId);
                if (channelExists) {
                    channelIdToSet = lastChannelId;
                }
            }

            set({
                activeServerId: serverId,
                activeChannelId: channelIdToSet
            });
        },

        setServersJoined(userId: string, servers: string[]) {
            set((state) => ({ serversJoined: { ...state.serversJoined, [userId]: servers } }))
        },

        setServers: (servers: Record<string, Server>) => set({ servers }),
        addServer: (server: Server) => set((state) => ({ servers: { ...state.servers, [server.serverId]: server } })),
        removeServer: (serverId: string) => set((state) => {
            const { [serverId]: removed, ...remainingServers } = state.servers;
            const { [serverId]: removedChannel, ...remainingChannels } = state.lastActiveChannelByServer;
            return {
                servers: remainingServers,
                lastActiveChannelByServer: remainingChannels
            };
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

        clearAllServers: () => set({ servers: {}, lastActiveChannelByServer: {} }),
    }
}), {
    name: "subspace-server-state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        activeServerId: state.activeServerId,
        lastActiveChannelByServer: state.lastActiveChannelByServer,
        servers: state.servers,
        serversJoined: state.serversJoined,
    })
}))