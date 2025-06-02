import { Constants } from "../constants"
import { ConnectionManager } from "."
import { Logger } from "@/lib/utils"
import { aofetch } from "ao-fetch"
import type { Server, ServerMember, Message, ServerDetailsResponse, VersionResponse } from "@/types/subspace"
import { CategoryManager } from "./category"
import { MessageManager } from "./message"
import { ChannelManager } from "./channel"
import { RoleManager } from "./role"

export class ServerManager {
    category: CategoryManager
    channel: ChannelManager
    message: MessageManager
    role: RoleManager

    constructor(private connectionManager: ConnectionManager) {
        this.category = new CategoryManager(this.connectionManager)
        this.channel = new ChannelManager(this.connectionManager)
        this.message = new MessageManager(this.connectionManager)
        this.role = new RoleManager(this.connectionManager)
    }

    // TODO: custom module with server code preloaded?
    // ALT: Bootloader
    async createServer({ name, icon }: { name: string, icon?: string }): Promise<string | null> {
        let tags = [
            ...Constants.CommonTags,
            { name: "Name", value: name },
            { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.CreateServer },
        ]

        const serverId = await this.connectionManager.spawn({ tags })
        if (!serverId) Logger.error("createServer", {})

        const initRes = await this.connectionManager.execLua({
            processId: serverId,
            code: `${Constants.SERVER_SOURCE}\nserver_icon = ${icon ? `"${icon}"` : "server_icon"}`,
            tags
        })
        const res = this.connectionManager.parseOutput(initRes)
        Logger.info("createServer", { json: res })
        return serverId;
    }

    async updateServer({ serverId, name = "", icon = "" }: { serverId: string, name?: string, icon?: string }): Promise<boolean> {
        const path = `${serverId}/update-server`
        const res = await aofetch(path, {
            method: "POST",
            body: { name, icon },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateServer },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("updateServer", res);
            return false;
        }
    }

    async updateServerCode({ serverId }: { serverId: string }): Promise<boolean> {
        try {
            const result = await this.connectionManager.execLua({
                processId: serverId,
                code: Constants.SERVER_SOURCE,
                tags: [
                    ...Constants.CommonTags,
                    { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateServerCode }
                ]
            })

            const output = this.connectionManager.parseOutput(result)
            Logger.info("updateServerCode", { json: output })
            return true;
        } catch (error) {
            Logger.error("updateServerCode", { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }

    async getServerDetails({ serverId }: { serverId: string }): Promise<ServerDetailsResponse | null> {
        const path = `${serverId}/`
        const res = await aofetch(path, {
            method: "GET",
            AO: this.connectionManager.getAo(),
        })
        if (res.status == 200) {
            return res.json as ServerDetailsResponse;
        } else {
            Logger.error("getServerDetails", res);
            return null;
        }
    }
    async getServerMember({ serverId, userId }: { serverId: string, userId: string }): Promise<ServerMember | null> {
        const path = `${serverId}/single-member`
        const res = await aofetch(path, {
            method: "GET",
            body: { userId },
            AO: this.connectionManager.getAo(),
        })
        if (res.status == 200) {
            return res.json as ServerMember;
        } else {
            Logger.error("getServerMember", res);
            return null;
        }
    }
    async getServerMembers({ serverId, userIds }: { serverId: string, userIds?: string[] }): Promise<ServerMember[] | null> {
        const path = `${serverId}/get-members`
        const res = await aofetch(path, {
            method: "GET",
            AO: this.connectionManager.getAo()
        })
        if (res.status == 200) {
            console.log(res.json)
            return res.json as ServerMember[];
        } else {
            Logger.error("getServerMembers", res);
            return null;
        }
    }

    async updateMember({ serverId, nickname = "" }: { serverId: string, nickname: string }): Promise<boolean> {
        const path = `${serverId}/update-nickname`
        const res = await aofetch(path, {
            method: "POST",
            body: { nickname },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateMember },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("updateMember", res);
            return false;
        }
    }

    async getVersion({ serverId }: { serverId: string }): Promise<string | null> {
        const path = `${serverId}/get-version`
        const res = await aofetch(path, {
            method: "GET",
            AO: this.connectionManager.getAo()
        })
        if (res.status == 200) {
            const response = res.json as VersionResponse;
            return response.version;
        } else {
            Logger.error("getVersion", res);
            return null;
        }
    }
}