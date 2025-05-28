import { Logger } from "@/lib/utils";

import { aofetch } from "ao-fetch";
import type { ConnectionManager } from ".";
import type { Message } from "@/types/subspace";
import { Constants } from "../constants";

export class MessageManager {
    constructor(private connectionManager: ConnectionManager) { }

    async getMessages({ serverId, channelId, limit = 100, before, after }: { serverId: string, channelId: number, limit?: number, before?: number, after?: number }): Promise<Message[] | null> {
        const path = `${serverId}/get-messages`
        const body = { channelId, limit }

        if (before && !after && before > 0) body['before'] = before
        if (after && !before && after > 0) body['after'] = after
        if (before && after && before > 0 && after > 0) body['after'] = after

        const res = await aofetch(path, {
            method: "GET",
            body,
            AO: this.connectionManager.getAo()
        })
        if (res.status == 200) {
            return res.json as Message[];
        } else {
            Logger.error("getMessages", res);
            return null;
        }
    }

    async sendMessage({ serverId, channelId, content, attachments = [], replyTo }: { serverId: string, channelId: number, content: string, attachments?: string[], replyTo?: number }): Promise<boolean> {
        const body = { channelId, content, attachments: JSON.stringify(attachments) }
        if (replyTo) body['replyTo'] = replyTo

        const path = `${serverId}/send-message`
        const res = await aofetch(path, {
            method: "POST",
            body,
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.SendMessage },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("sendMessage", res);
            return false;
        }
    }

    async editMessage({ serverId, messageId, content }: { serverId: string, messageId: string, content: string }): Promise<boolean> {
        const path = `${serverId}/edit-message`
        const res = await aofetch(path, {
            method: "POST",
            body: { messageId, content },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateMessage },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("editMessage", res);
            return false;
        }
    }

    async deleteMessage({ serverId, messageId }: { serverId: string, messageId: string }): Promise<boolean> {
        const path = `${serverId}/delete-message`
        const res = await aofetch(path, {
            method: "POST",
            body: { messageId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.DeleteMessage },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("deleteMessage", res);
            return false;
        }
    }
}