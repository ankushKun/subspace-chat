import { Logger } from "@/lib/utils";

import { aofetch } from "ao-fetch";
import type { ConnectionManager } from ".";
import type { Message } from "@/types/subspace";
import { Constants } from "../constants";

export class MessageManager {
    constructor(private connectionManager: ConnectionManager) { }

    async getMessage({ serverId, messageId, messageTxId }: { serverId: string, messageId?: string, messageTxId?: string }): Promise<Message | null> {
        const path = `${serverId}/get-single-message`
        const body = {}
        if (messageId) body['messageId'] = messageId
        if (messageTxId) body['messageTxId'] = messageTxId

        const res = await aofetch(path, {
            method: "GET",
            body,
            AO: this.connectionManager.getAo()
        })
        if (res.status == 200) {
            return res.json as Message;
        } else {
            Logger.error("getMessage", res);
            return null;
        }
    }

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
                { name: "Subspace-Server-ID", value: serverId }
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("sendMessage", res);
            return false;
        }
    }

    async editMessage({ serverId, messageId, messageTxId = "", content }: { serverId: string, messageId: string, messageTxId: string, content: string }): Promise<boolean> {
        const path = `${serverId}/edit-message`
        const res = await aofetch(path, {
            method: "POST",
            body: { messageId, content },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateMessage },
                { name: "Subspace-Server-ID", value: serverId },
                { name: "Subspace-Original-Message-ID", value: messageTxId },
                { name: "Subspace-Timestamp-Milliseconds", value: `${Date.now()}` }
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("editMessage", res);
            return false;
        }
    }

    async deleteMessage({ serverId, messageId, messageTxId = "" }: { serverId: string, messageId: string, messageTxId: string }): Promise<boolean> {
        const path = `${serverId}/delete-message`
        const res = await aofetch(path, {
            method: "POST",
            body: { messageId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.DeleteMessage },
                { name: "Subspace-Server-ID", value: serverId },
                { name: "Subspace-Original-Message-ID", value: messageTxId },
                { name: "Subspace-Timestamp-Milliseconds", value: `${Date.now()}` }
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