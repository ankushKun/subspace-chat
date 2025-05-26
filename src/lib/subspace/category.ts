import { aofetch } from "ao-fetch";
import { ConnectionManager } from ".";
import { Logger } from "@/lib/utils";
import { Constants } from "../constants";
import type { CreateCategoryResponse } from "@/types/subspace";

export class CategoryManager {
    constructor(private connectionManager: ConnectionManager) { }

    async createCategory({ serverId, name, orderId }: { serverId: string, name: string, orderId?: number }): Promise<number | null> {
        const path = `${serverId}/create-category`
        const res = await aofetch(path, {
            method: "POST",
            body: { name, orderId },
            AO: this.connectionManager.getAo(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.CreateCategory },
            ]
        })
        if (res.status == 200) {
            const response = res.json as CreateCategoryResponse;
            return response.categoryId;
        } else {
            Logger.error("createCategory", res);
            return null;
        }
    }

    async updateCategory({ serverId, categoryId, name, orderId }: { serverId: string, categoryId: string, name?: string, orderId?: number }): Promise<boolean> {
        const path = `${serverId}/update-category`
        const res = await aofetch(path, {
            method: "POST",
            body: { categoryId, name, orderId },
            AO: this.connectionManager.getAo(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.UpdateCategory },
            ]
        })
        if (res.status == 200) {
            return true;
        } else {
            Logger.error("updateCategory", res);
            return false;
        }
    }

    async deleteCategory({ serverId, categoryId }: { serverId: string, categoryId: string }): Promise<number | null> {
        const path = `${serverId}/delete-category`
        const res = await aofetch(path, {
            method: "POST",
            body: { categoryId },
            AO: this.connectionManager.getAo(),
            tags: [
                ...Constants.CommonTags,
                { name: Constants.TagNames.SubspaceFunction, value: Constants.TagValues.DeleteCategory },
            ]
        })
        if (res.status == 200) {
            const response = res.json as { channelsUpdated: number };
            return response.channelsUpdated;
        } else {
            Logger.error("deleteCategory", res);
            return null;
        }
    }
}