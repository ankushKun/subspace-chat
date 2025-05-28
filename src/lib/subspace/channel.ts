import { aofetch } from "ao-fetch";
import { ConnectionManager } from ".";
import { Logger } from "@/lib/utils";
import { Constants } from "../constants";
import type { CreateChannelResponse } from "@/types/subspace";

export class ChannelManager {
    constructor(private connectionManager: ConnectionManager) { }

    async createChannel({ serverId, parentCategoryId, name, orderId = undefined }: { serverId: string, parentCategoryId?: string, name: string, orderId?: number }): Promise<CreateChannelResponse | null> {
        const body = { parentCategoryId, name }
        if (orderId !== undefined) {
            body['orderId'] = orderId;
        }
        const path = `${serverId}/create-channel`
        const res = await aofetch(path, {
            method: "POST",
            body,
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.CreateChannel },
            ]
        })
        if (res.status == 200) {
            return res.json as CreateChannelResponse;
        } else {
            Logger.error("createChannel", res);
            return null;
        }
    }

    async updateChannel({ serverId, channelId, name, parentCategoryId, orderId = undefined }: { serverId: string, channelId: string, name?: string, parentCategoryId?: string, orderId?: number }): Promise<boolean> {
        const body = { channelId }
        if (orderId !== undefined) {
            body['orderId'] = orderId;
        }
        if (name !== undefined) {
            body['name'] = name;
        }
        if (parentCategoryId !== undefined) {
            body['parentCategoryId'] = parentCategoryId;
        }
        const path = `${serverId}/update-channel`
        const res = await aofetch(path, {
            method: "POST",
            body,
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateChannel },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("updateChannel", res);
            return false;
        }
    }

    async deleteChannel({ serverId, channelId }: { serverId: string, channelId: string }): Promise<number | null> {
        const path = `${serverId}/delete-channel`
        const res = await aofetch(path, {
            method: "POST",
            body: { channelId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.DeleteChannel },
            ]
        })
        if (res.status == 200) {
            const response = res.json as { messagesDeleted: number };
            return response.messagesDeleted;
        } else {
            Logger.error("deleteChannel", res);
            return null;
        }
    }

    async markRead({ serverId, channelId }: { serverId?: string, channelId?: number }): Promise<number | null> {
        const data = {}
        if (serverId) {
            data['serverId'] = serverId;
        }
        if (channelId) {
            data['channelId'] = channelId;
        }
        const path = `${Constants.Profiles}/mark-read`
        const res = await aofetch(path, {
            method: "POST",
            body: data,
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
            ]
        })
        if (res.status == 200) {
            const response = res.json as { notificationsDeleted: number };
            return response.notificationsDeleted;
        } else {
            Logger.error("markRead", res);
            return null;
        }
    }
}   