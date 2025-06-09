import { Logger } from "@/lib/utils";
import { aofetch } from "ao-fetch";
import { Constants } from "../constants";
import { ANT } from "@ar.io/sdk"

import type { ConnectionManager } from ".";
import type { Profile, SubspaceNotification, DelegationDetails } from "@/types/subspace";


export class User {

    constructor(private connectionManager: ConnectionManager) { }

    async getProfile({ userId }: { userId: string }): Promise<Profile | null> {
        const path = `${Constants.Profiles}/profile`
        const res = await aofetch(path, {
            method: "GET",
            body: { userId },
            AO: this.connectionManager.getAo()
        })

        if (res.status == 200) {
            const profile = res.json as Profile;

            // Ensure serversJoined is always a string array
            if (profile.serversJoined) {
                if (typeof profile.serversJoined === 'string') {
                    try {
                        const parsed = JSON.parse(profile.serversJoined);
                        profile.serversJoined = Array.isArray(parsed) ? parsed : [];
                    } catch {
                        profile.serversJoined = [];
                    }
                } else if (!Array.isArray(profile.serversJoined)) {
                    profile.serversJoined = [];
                }
            } else {
                profile.serversJoined = [];
            }

            try {
                const primaryName = await this.getPrimaryName({ userId })
                profile.primaryName = primaryName;
            } catch {

            }
            return profile;
        } else {
            Logger.error("getProfile", res);
            return null;
        }
    }

    async getPrimaryName({ userId }: { userId: string }) {
        try {
            const res = await this.connectionManager.ario.getPrimaryName({ address: userId })
            if (res && res.name) {
                return res.name
            }
        } catch (e) {
            Logger.error("getPrimaryName", e)
            return null;
        }
        return null;
    }

    async getPrimaryLogo({ userId }: { userId: string }) {
        try {
            const primaryName = await this.connectionManager.ario.getPrimaryName({ address: userId })
            const ant = ANT.init({ processId: primaryName.processId })
            const logo = await ant.getLogo()
            return logo
        } catch (e) {
            Logger.error("getPrimaryLogo", e)
            return null;
        }
        return null;
    }

    // async updateProfile({ username, pfp }: { username?: string, pfp?: string }): Promise<boolean> {
    async updateProfile({ pfp }: { pfp?: string }): Promise<boolean> {
        const path = `${Constants.Profiles}/update-profile`
        const res = await aofetch(path, {
            method: "POST",
            body: { pfp },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateProfile },
            ]
        });

        if (res.status == 200) {
            return true;
        } else {
            Logger.error("updateProfile", res);
            return false;
        }
    }

    async getNotifications({ userId }: { userId: string }): Promise<SubspaceNotification[] | null> {
        const path = `${Constants.Profiles}/get-notifications`
        const res = await aofetch(path, {
            method: "GET",
            body: { userId },
            AO: this.connectionManager.getAo()
        })

        if (res.status == 200) {
            return res.json as SubspaceNotification[];
        } else {
            Logger.error("getNotifications", res);
            return null;
        }
    }

    async getBulkProfiles({ userIds }: { userIds: string[] }): Promise<Profile[] | null> {
        const path = `${Constants.Profiles}/bulk-profile`
        const res = await aofetch(path, {
            method: "GET",
            body: { userIds: JSON.stringify(userIds) },
            AO: this.connectionManager.getAo()
        })

        if (res.status == 200) {
            return res.json as Profile[];
        } else {
            Logger.error("getBulkProfiles", res);
            return null;
        }
    }

    async delegateUser({ userId }: { userId: string }): Promise<boolean> {
        const path = `${Constants.Profiles}/delegate`
        const res = await aofetch(path, {
            method: "POST",
            body: { userId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.DelegateUser },
            ]
        })

        if (res.status == 200) {
            return true;
        } else {
            Logger.error("delegateUser", res);
            return false;
        }
    }

    async undelegateUser(): Promise<boolean> {
        const path = `${Constants.Profiles}/undelegate`
        const res = await aofetch(path, {
            method: "POST",
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UndelegateUser },
            ]
        })

        if (res.status == 200) {
            return true;
        } else {
            Logger.error("undelegateUser", res);
            return false;
        }

    }
    async getDelegationDetails({ userId }: { userId?: string }): Promise<DelegationDetails | null> {
        const path = `${Constants.Profiles}/check-delegation`
        const res = await aofetch(path, {
            method: "GET",
            body: { userId },
            AO: this.connectionManager.getAo(),
            CU_URL: this.connectionManager.getCuUrl()
        })

        if (res.status == 200) {
            return res.json as DelegationDetails;
        } else {
            Logger.error("getDelegationDetails", res);
            return null;
        }
    }

    async joinServer({ serverId }: { serverId: string }): Promise<boolean> {
        const path = `${Constants.Profiles}/join-server`
        const res = await aofetch(path, {
            method: "POST",
            body: { serverId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.JoinServer },
            ]
        })

        if (res.status == 200) {
            return true;
        } else {
            Logger.error("joinServer", res);
            return false;
        }

    }

    async leaveServer({ serverId }: { serverId: string }): Promise<boolean> {
        const path = `${Constants.Profiles}/leave-server`
        const res = await aofetch(path, {
            method: "POST",
            body: { serverId },
            AO: this.connectionManager.getAo(),
            signer: this.connectionManager.getAoSigner(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.LeaveServer },
            ]
        })

        if (res.status == 200) {
            return true;
        } else {
            Logger.error("leaveServer", res);
            return false;
        }
    }
}