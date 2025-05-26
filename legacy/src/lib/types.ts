export type Tag = { name: string; value: string };

export type Category = {
    id: number
    name: string
    order_id: number
}

export type Channel = {
    id: number
    name: string
    order_id: number
    category_id: number | null
}

export type Member = {
    id: string
    nickname: string | null
}

export type Server = {
    categories: Category[]
    channels: Channel[]
    name: string
    icon: string
    owner: string
    member_count: number
}

export interface GlobalState {
    activeServerId: string | null
    setActiveServerId: (server: string | null) => void
    activeServer: Server | null
    setActiveServer: (server: Server | null) => void
    activeChannelId: number | null
    setActiveChannelId: (channelId: number | null) => void

    // Member management
    serverMembers: Map<string, Member[]>
    isLoadingMembers: boolean
    fetchServerMembers: (serverId: string, forceRefresh?: boolean) => Promise<void>
    getServerMembers: (serverId: string) => Member[] | null
}

