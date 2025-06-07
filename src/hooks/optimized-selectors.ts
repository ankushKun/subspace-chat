import { useMemo } from 'react'
import { useWallet } from './use-wallet'
import { useServer } from './subspace/server'
import { useProfile } from './subspace/profiles'
import { useMessages } from './subspace/messages'
import { useNotifications } from './subspace/notifications'

// Optimized wallet selectors
export const useWalletConnection = () => {
    const connected = useWallet((state) => state.connected)
    const address = useWallet((state) => state.address)
    const connectionStrategy = useWallet((state) => state.connectionStrategy)

    return useMemo(() => ({
        connected,
        address,
        connectionStrategy
    }), [connected, address, connectionStrategy])
}

export const useWalletActions = () => useWallet((state) => state.actions)

// Optimized server selectors
export const useActiveServer = () => {
    const activeServerId = useServer((state) => state.activeServerId)
    const activeChannelId = useServer((state) => state.activeChannelId)
    const servers = useServer((state) => state.servers)

    return useMemo(() => ({
        activeServerId,
        activeChannelId,
        server: activeServerId ? servers[activeServerId] : null
    }), [activeServerId, activeChannelId, servers])
}

export const useServerActions = () => useServer((state) => state.actions)

export const useServersData = () => {
    const servers = useServer((state) => state.servers)
    const serversJoined = useServer((state) => state.serversJoined)
    const loadingServers = useServer((state) => state.loadingServers)

    return useMemo(() => ({
        servers,
        serversJoined,
        loadingServers
    }), [servers, serversJoined, loadingServers])
}

// Optimized profile selectors
export const useProfileActions = () => useProfile((state) => state.actions)

export const useProfilesData = () => useProfile((state) => state.profiles)

// Optimized message selectors
export const useMessagesActions = () => useMessages((state) => state.actions)

export const useChannelMessages = (serverId: string, channelId: number) =>
    useMessages((state) => state.messages[serverId]?.[channelId] || [])

// Optimized notification selectors
export const useNotificationActions = () => useNotifications((state) => state.actions)

export const useUnreadCounts = () => {
    const unreadCount = useNotifications((state) => state.unreadCount)
    const unreadCountsByServer = useNotifications((state) => state.unreadCountsByServer)

    return useMemo(() => ({
        unreadCount,
        unreadCountsByServer
    }), [unreadCount, unreadCountsByServer])
} 