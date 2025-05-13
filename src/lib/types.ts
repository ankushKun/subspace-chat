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

export type Server = {
    categories: Category[]
    channels: Channel[]
    name: string
    icon: string
}

export interface GlobalState {
    activeServerId: string | null
    setActiveServerId: (server: string | null) => void
    activeServer: Server | null
    setActiveServer: (server: Server | null) => void
}

