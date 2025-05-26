import { aofetch } from "ao-fetch";
import { ConnectionManager } from ".";
import { Logger } from "@/lib/utils";
import { Constants } from "../constants";
import type { CreateChannelResponse } from "@/types/subspace";

export class ChannelManager {
    constructor(private connectionManager: ConnectionManager) { }

    async createChannel({ serverId, parentCategoryId, name, orderId }: { serverId: string, parentCategoryId?: string, name: string, orderId?: number }): Promise<CreateChannelResponse | null> {
        const path = `${serverId}/create-channel`
        const res = await aofetch(path, {
            method: "POST",
            body: { parentCategoryId, name, orderId },
            AO: this.connectionManager.getAo(),
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

    async updateChannel({ serverId, channelId, name, parentCategoryId, orderId }: { serverId: string, channelId: string, name?: string, parentCategoryId?: string, orderId?: number }): Promise<boolean> {
        const path = `${serverId}/update-channel`
        const res = await aofetch(path, {
            method: "POST",
            body: { channelId, name, parentCategoryId, orderId },
            AO: this.connectionManager.getAo(),
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

    async markRead({ serverId, channelId }: { serverId: string, channelId: string }): Promise<number | null> {
        const path = `${Constants.Profiles}/mark-read`
        const res = await aofetch(path, {
            method: "POST",
            body: { serverId, channelId },
            AO: this.connectionManager.getAo(),
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