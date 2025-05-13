export type Tag = { name: string; value: string };

export type Server = {
    categories: string[]
    channels: string[]
    name: string
    icon: string
}

export interface GlobalState {
    activeServerId: string | null
    setActiveServerId: (server: string | null) => void
    activeServer: Server | null
    setActiveServer: (server: Server | null) => void
}

