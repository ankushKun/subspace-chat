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

export type ReplyToMessage = {
    messageId: number
    content: string
    authorId: string
    timestamp: number
    edited: number
    attachments: string
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
    replyToMessage?: ReplyToMessage
}

export type Member = {
    userId: string
    nickname: string | null
}

// TODO: implement permissions

export enum Permission {
    SEND_MESSAGES = 1 << 0, // 1
    MANAGE_NICKNAMES = 1 << 1, // 2
    MANAGE_MESSAGES = 1 << 2, // 4
    KICK_MEMBERS = 1 << 3, // 8
    BAN_MEMBERS = 1 << 4, // 16
    MANAGE_CHANNELS = 1 << 5, // 32
    MANAGE_SERVER = 1 << 6, // 64
    MANAGE_ROLES = 1 << 7, // 128
    MANAGE_MEMBERS = 1 << 8, // 256
    MENTION_EVERYONE = 1 << 9, // 512
    ADMINISTRATOR = 1 << 10, // 1024
}

// function input = permission number, output = array of permissions
export const getPermissions = (perms: number): Permission[] => {
    return Object.values(Permission).filter((p: Permission) => (perms & p) === p) as Permission[];
}

export const hasPermission = (sum: number, perm: Permission): boolean => {
    return (sum & perm) === perm
}

export type Role = {
    roleId: number
    name: string
    orderId: number
    permissions: number
    color: string
}

export type ServerMember = {
    userId: string;
    nickname: string | null;
    roles: number[]; // JSON encoded array of role IDs
}

export type Server = {
    serverId: string;
    categories: Category[];
    channels: Channel[];
    roles: Role[];
    name: string;
    icon: string;
    owner: string;
    member_count: number;
    members?: ServerMember[];
}

export type Profile = {
    userId: string;
    // username: string;
    pfp: string;
    serversJoined: string[];
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
    roles: Role[];
}

export type VersionResponse = {
    version: string;
}

export type ErrorResponse = {
    error: string;
}