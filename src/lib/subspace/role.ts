import { aofetch } from "ao-fetch";
import { ConnectionManager } from ".";
import { Logger } from "@/lib/utils";
import { Constants } from "../constants";
import type { Member, Role } from "@/types/subspace";

export class RoleManager {
    constructor(private connectionManager: ConnectionManager) { }

    async getRoles({ serverId }: { serverId: string }): Promise<Role[] | null> {
        const path = `${serverId}/get-roles`
        const res = await aofetch(path, {
            method: "GET",
            AO: this.connectionManager.getAo()
        })
        if (res.status == 200) {
            return res.json as Role[];
        } else {
            Logger.error("getRoles", res);
            return null;
        }
    }

    async getRole({ serverId, roleId }: { serverId: string, roleId: number }): Promise<Role | null> {
        const path = `${serverId}/get-role`
        const res = await aofetch(path, {
            method: "GET",
            body: { roleId },
            AO: this.connectionManager.getAo()
        })
        if (res.status == 200) {
            return res.json as Role;
        } else {
            Logger.error("getRole", res);
            return null;
        }
    }

    async getRoleMembers({ serverId, roleId }: { serverId: string, roleId: number }): Promise<Member[] | null> {
        const path = `${serverId}/get-role-members`
        const res = await aofetch(path, {
            method: "GET",
            body: { roleId },
            AO: this.connectionManager.getAo()
        })
        console.log(res);
        if (res.status == 200) {
            return res.json as Member[];
        } else {
            Logger.error("getRoleMembers", res);
            return null;
        }
    }

    async createRole({ serverId, name = "New Role", color = "#696969", permissions = 1 }: { serverId: string, name?: string, color?: string, permissions?: number }): Promise<boolean> {
        const path = `${serverId}/create-role`
        const res = await aofetch(path, {
            method: "POST",
            body: { name, color, permissions },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.CreateRole },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("createRole", res);
            return false;
        }
    }

    async updateRole({ serverId, roleId, name, color, permissions, orderId }: { serverId: string, roleId: number, name?: string, color?: string, permissions?: number, orderId?: number }): Promise<boolean> {
        const body = { roleId }
        if (name !== undefined) body['name'] = name;
        if (color !== undefined) body['color'] = color;
        if (permissions !== undefined) body['permissions'] = permissions;
        if (orderId !== undefined) body['orderId'] = orderId;

        const path = `${serverId}/update-role`
        const res = await aofetch(path, {
            method: "POST",
            body,
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateRole },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("updateRole", res);
            return false;
        }
    }

    async deleteRole({ serverId, roleId }: { serverId: string, roleId: number }): Promise<number | null> {
        const path = `${serverId}/delete-role`
        const res = await aofetch(path, {
            method: "POST",
            body: { roleId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.DeleteRole },
            ]
        })
        if (res.status == 200) {
            const response = res.json as { usersUpdated: number };
            return response.usersUpdated;
        } else {
            Logger.error("deleteRole", res);
            return null;
        }
    }

    async assignRole({ serverId, userId, roleId }: { serverId: string, userId: string, roleId: number }): Promise<boolean> {
        const path = `${serverId}/assign-role`
        const res = await aofetch(path, {
            method: "POST",
            body: { userId, roleId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.AssignRole },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("assignRole", res);
            return false;
        }
    }

    async unassignRole({ serverId, userId, roleId }: { serverId: string, userId: string, roleId: number }): Promise<boolean> {
        const path = `${serverId}/unassign-role`
        const res = await aofetch(path, {
            method: "POST",
            body: { userId, roleId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UnassignRole },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("unassignRole", res);
            return false;
        }
    }
}