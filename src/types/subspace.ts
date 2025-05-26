export type Category = {
    categoryId: number
    name: string
    orderId: number
}

export type Channel = {
    channelId: number
    name: string
    orderId: number
    categoryId: number | null
}

export type Message = {
    messageId: number
    content: string
    channelId: number
    authorId: string
    messageTxId: string
    timestamp: number
    edited: number
    attachments: string
    replyTo: number | null
}

export type Member = {
    userId: string
    nickname: string | null
}

// TODO: implement permissions

// 0000 0000 0000 0000
// bit 1: ADMINISTRATOR
// bit 2: MANAGE_SERVER
// bit 3: DELETE_MESSAGES
// bit 4: KICK_MEMBERS
// bit 5: BAN_MEMBERS
// bit 6: MANAGE_CHANNELS

export enum Permission {
    ADMINISTRATOR = 1 << 0, // 1
    MANAGE_SERVER = 1 << 1, // 2
    DELETE_MESSAGES = 1 << 2, // 4
    KICK_MEMBERS = 1 << 3, // 8
    BAN_MEMBERS = 1 << 4, // 16
    MANAGE_CHANNELS = 1 << 5, // 32
}

// a role with perms kick and ban = 1<<3 + 1<<4 = 24
// and its binary is 0000 0000 0001 1000 = 24

// function input = permission number, output = array of permissions
export const getPermissions = (perms: number): Permission[] => {
    return Object.values(Permission).filter((p: Permission) => (perms & p) === p) as Permission[];
}

export type Role = {
    id: string
    name: string
    order_id: number
    permissions: number
}

export type ServerMember = {
    userId: string;
    nickname: string | null;
    // TODO: implement roles
}

export type Server = {
    id: string;
    categories: Category[];
    channels: Channel[];
    // roles: Role[]; // TODO: implement
    name: string;
    icon: string;
    owner: string;
    member_count: number;
    members?: ServerMember[];
}

export type Profile = {
    userId: string;
    username: string;
    pfp: string;
    serversJoined: string;
    primaryName?: string | null;
    originalId?: string;
}

export type SubspaceNotification = {
    notificationId: number;
    userId: string;
    serverId: string;
    channelId: number;
    messageId: string;
    authorId: string;
    authorName: string;
    content: string;
    channelName: string;
    serverName: string;
    timestamp: number;
    read: number;
}

// API Response Types
export type DelegationDetails = {
    isDelegatee: boolean;
    originalId: string;
    delegatedId: string | null;
}

export type MarkReadResponse = {
    notificationsDeleted: number;
}

export type CreateCategoryResponse = {
    categoryId: number;
}

export type CreateChannelResponse = {
    channelId: number;
    orderId: number;
}

export type DeleteCategoryResponse = {
    channelsUpdated: number;
}

export type DeleteChannelResponse = {
    messagesDeleted: number;
}

export type ServerDetailsResponse = {
    name: string;
    icon: string;
    owner: string;
    categories: Category[];
    channels: Channel[];
    member_count: number;
}

export type VersionResponse = {
    version: string;
}

export type ErrorResponse = {
    error: string;
}