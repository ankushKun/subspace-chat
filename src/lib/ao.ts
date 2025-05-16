import { aofetch } from "ao-fetch"
import { connect, createDataItemSigner } from "@permaweb/aoconnect"
import { ArconnectSigner, ArweaveSigner, type JWKInterface } from "@dha-team/arbundles"
import type { MessageResult } from "node_modules/@permaweb/aoconnect/dist/lib/result";
import type { Tag } from "@/lib/types"
import Arweave from "arweave";
import { useGlobalState } from "@/hooks/global-state"; // Import for the refresh function
import { ARIO } from "@ar.io/sdk";  // Import AR.IO SDK
import { toast } from "sonner";  // Use sonner for toast messages
import {
    TurboAuthenticatedClient,
    TurboFactory,
    TurboWebArweaveSigner,
} from '@ardrive/turbo-sdk/web';
import { ReadableStream } from 'web-streams-polyfill';
import type { JWKPublicInterface } from "arweave/web/lib/wallet";
import { createLogger } from '@/lib/logger'

// Create a logger for this module
const logger = createLogger('ao');

// @ts-ignore
const serverSource = `${__SERVER_SRC__}`
// @ts-ignore
const aoxpressSource = `${__AOXPRESS_SRC__}`

// Initialize AR.IO client
const ario = ARIO.mainnet();

const SCHEDULER = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA"
const MODULE = "33d-3X8mpv6xYBlVB-eXMrPfH5Kzf6Hiwhcv0UA10sw"

export const PROFILES = "J-GI_SARbZ8O0km4JiE2lu2KJdZIWMo53X3HrqusXjY"

const CommonTags: Tag[] = [
    { name: "App-Name", value: "Subspace-Chat" },
    // @ts-ignore
    { name: "App-Version", value: __APP_VERSION__ || "DEV" },
    { name: 'Authority', value: 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY' },
];


const ao = connect({
    MODE: "legacy",
    CU_URL: `https://cu.ardrive.io`,
})

// Helper function to refresh data after operations
// This can be called by components using these functions
export async function refreshCurrentServerData() {
    try {
        const globalState = useGlobalState.getState();
        return await globalState.refreshServerData();
    } catch (error) {
        logger.error("Failed to refresh server data:", error);
        throw new Error("Failed to refresh server data. Please try again or reload the application.");
    }
}

export function to(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

export async function createServer(name: string, icon: File) {
    logger.info("Spawning server...", { name, icon: icon.name });

    // Read the file as an ArrayBuffer properly
    const iconUint8Array = await to(icon);

    logger.info("Icon array buffer created", iconUint8Array.byteLength, icon.type);

    const serverId = await ao.spawn({
        scheduler: SCHEDULER,
        module: MODULE,
        signer: createDataItemSigner(window.arweaveWallet),
        tags: [
            ...CommonTags,
            { name: "Name", value: name },
            { name: "Content-Type", value: icon.type }
        ],
        data: iconUint8Array
    })

    logger.info("Got server id", serverId);

    logger.info("Loading aoxpress...");
    const aoxpressRes = await runLua(aoxpressSource, serverId)
    logger.info("AoXpress result:", await parseOutput(aoxpressRes));
    logger.info("aoxpress loaded");

    logger.info("Initializing server...");
    const initServerRes = await runLua(serverSource, serverId)
    logger.info("Server initialization result:", await parseOutput(initServerRes));
    logger.info("Server initialized");

    logger.info("Updating server details...");
    const updateServerRes = await aofetch(`${serverId}/update-server`, {
        method: "POST",
        body: {
            name: name,
            icon: serverId
        }
    })
    logger.info("Update server response:", JSON.stringify(updateServerRes));

    if (updateServerRes.status == 200) {
        logger.info("Server details updated");
    } else {
        throw new Error(updateServerRes.error);
    }

    logger.info("Joining server...");
    const joinServerRes = await aofetch(`${PROFILES}/join-server`, {
        method: "POST",
        body: {
            server_id: serverId
        }
    })
    logger.info("Join server response:", JSON.stringify(joinServerRes));
    if (joinServerRes.status == 200) {
        logger.info("Server joined");
    } else {
        throw new Error(joinServerRes.error);
    }

    return serverId;
}

export async function runLua(code: string, process: string, tags?: Tag[]) {
    logger.info("Running lua", code);

    if (tags) {
        tags = [...CommonTags, ...tags];
    } else {
        tags = CommonTags;
    }

    tags = [...tags, { name: "Action", value: "Eval" }];

    const message = await ao.message({
        process,
        data: code,
        signer: createDataItemSigner(window.arweaveWallet),
        tags,
    });
    // delay 100ms before getting result
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await ao.result({ process, message });
    // console.log(result);
    (result as any).id = message;
    return result;
}

export function parseOutput(msg: MessageResult) {
    if (msg.Error) {
        throw new Error(msg.Error);
    }
    if (msg.Output && msg.Output.data) {
        try {
            return JSON.parse(msg.Output.data);
        } catch (e) {
            return msg.Output.data;
        }
    }
    if (msg.Messages.length == 1) {
        return msg.Messages[0];
    } else if (msg.Messages.length > 1) {
        return msg.Messages;
    }
    return msg;
}

export async function uploadFileAndGetId(file: File): Promise<string> {
    logger.info(`[uploadFileAndGetId] Uploading file:`, file.name, file.size, file.type);


    // const fileId = await uploadWithTurbo(file)
    // console.log(`[uploadFileAndGetId] File uploaded successfully:`, fileId);
    // return fileId;

    // Using standard Arweave for reliable uploads
    try {
        const fileId = await uploadWithStandardArweave(file);
        logger.info(`[uploadFileAndGetId] File uploaded successfully:`, fileId);
        return fileId;
    } catch (error) {
        logger.error(`[uploadFileAndGetId] Upload failed:`, error);
        throw error;
    }
}

// async function uploadWithTurbo(file: File): Promise<string> {
//     const buffer = await file.arrayBuffer();
//     const ar = Arweave.init({})
//     const w = await ar.wallets.generate()
//     const turbo = TurboFactory.authenticated({ signer: new ArweaveSigner(w as JWKInterface) })
//     // const turbo = new TurboAuthenticatedClient({ signer: new ArconnectSigner(window.arweaveWallet) })
//     const fileId = await turbo.uploadFile({
//         fileStreamFactory: () => new ReadableStream({
//             start(controller) {
//                 controller.enqueue(buffer);
//                 controller.close();
//             },
//         }),
//         fileSizeFactory: () => file.size,
//         dataItemOpts: {
//             tags: [
//                 ...CommonTags,
//                 { name: "Content-Type", value: file.type }
//             ]
//         }
//     })
//     return fileId.id
// }

// Reliable implementation using standard Arweave
async function uploadWithStandardArweave(file: File): Promise<string> {
    logger.info(`[uploadWithStandardArweave] Starting upload:`, file.name);
    const ar = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
    });

    const fileData = await to(file);
    logger.info(`[uploadWithStandardArweave] File converted to Uint8Array:`, fileData.byteLength);

    const tx = await ar.createTransaction({ data: fileData }, "use_wallet");
    logger.info(`[uploadWithStandardArweave] Transaction created:`, tx.id);

    tx.addTag("Content-Type", file.type);
    tx.addTag("App-Name", "Subspace-Chat");
    // @ts-ignore
    tx.addTag("App-Version", window.APP_VERSION);

    logger.info(`[uploadWithStandardArweave] Signing transaction...`);
    await ar.transactions.sign(tx, "use_wallet");
    logger.info(`[uploadWithStandardArweave] Transaction signed, posting...`);

    const res = await ar.transactions.post(tx);
    logger.info(`[uploadWithStandardArweave] Transaction posted, status:`, res.status);

    if (res.status == 200) {
        return tx.id;
    } else {
        throw new Error(res.statusText);
    }
}

export async function getJoinedServers(address: string): Promise<string[]> {
    logger.info(`[getJoinedServers] Fetching joined servers for address: ${address}`);
    const res = await aofetch(`${PROFILES}/profile`, {
        method: "GET",
        body: {
            id: address
        },
    })
    logger.info(`[getJoinedServers] Response:`, res);

    if (res.status == 200) {
        // Cache the entire profile response in global state
        try {
            // Get the global state without using hooks
            const globalState = useGlobalState.getState();

            // Cache the profile data - use type assertion for the response
            const responseData = res.json as { profile: { servers_joined: string, [key: string]: any } };
            if (responseData && responseData.profile) {
                logger.info(`[getJoinedServers] Caching user profile data for ${address}`);
                globalState.setUserProfile(responseData);
            }
        } catch (error) {
            logger.warn(`[getJoinedServers] Failed to cache profile data:`, error);
        }

        // Extract and return the joined servers
        const responseData = res.json as { profile: { servers_joined: string } };
        const joinedServersString = responseData.profile.servers_joined === "{}" ? "[]" : responseData.profile.servers_joined;
        const servers = JSON.parse(joinedServersString);
        logger.info(`[getJoinedServers] Parsed servers:`, servers);
        return servers;
    } else {
        throw new Error(res.error);
    }
}

export async function getServerInfo(id: string) {
    logger.info(`[getServerInfo] Fetching server info for: ${id}`);
    const res = await aofetch(`${id}/`);
    logger.info(`[getServerInfo] Response:`, res);
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

// Global request tracking to persist across the entire application
const memberRequestLimiter = {
    serverRequests: new Map<string, number>(),
    lastAttemptTimes: new Map<string, number>(),
    MIN_REQUEST_INTERVAL: 60000, // 1 minute minimum between requests
    MAX_REQUESTS_PER_SERVER: 3,  // Maximum of 3 attempts per server per session
    isServerBlocked: function (serverId: string): boolean {
        const count = this.serverRequests.get(serverId) || 0;
        const lastAttempt = this.lastAttemptTimes.get(serverId) || 0;
        const now = Date.now();

        return count >= this.MAX_REQUESTS_PER_SERVER ||
            (now - lastAttempt < this.MIN_REQUEST_INTERVAL);
    },
    recordAttempt: function (serverId: string) {
        const count = this.serverRequests.get(serverId) || 0;
        this.serverRequests.set(serverId, count + 1);
        this.lastAttemptTimes.set(serverId, Date.now());
        logger.info(`[memberRequestLimiter] Recorded attempt ${count + 1}/${this.MAX_REQUESTS_PER_SERVER} for server ${serverId}`);
    },
    isInvalidMembersServer: function (serverId: string): boolean {
        try {
            const globalState = useGlobalState.getState();
            return globalState.invalidMemberServers.has(serverId);
        } catch (error) {
            logger.warn('[memberRequestLimiter] Error checking invalid members server:', error);
            return false;
        }
    }
};

export async function getMembers(serverId: string) {
    logger.info(`[getMembers] Fetching members for server: ${serverId}`);

    // Check if this server is already known to have invalid members
    if (memberRequestLimiter.isInvalidMembersServer(serverId)) {
        logger.info(`[getMembers] Server ${serverId} is known to have invalid members endpoint, aborting request`);
        throw new Error("Server does not support member listing");
    }

    // Check if we've exceeded request limits
    if (memberRequestLimiter.isServerBlocked(serverId)) {
        logger.info(`[getMembers] Server ${serverId} is blocked from further requests due to rate limiting`);

        // Mark as invalid in the global state to prevent future attempts
        try {
            // Mark this server as having an invalid members endpoint
            markServerInvalidMembers(serverId);
        } catch (error) {
            logger.warn('[getMembers] Error marking server invalid after rate limit:', error);
        }

        throw new Error("Rate limit exceeded for member requests to this server");
    }

    // Record this attempt
    memberRequestLimiter.recordAttempt(serverId);

    try {
        const res = await aofetch(`${serverId}/get-members`);
        logger.info(`[getMembers] Response:`, res);
        if (res.status == 200) {
            return res.json;
        } else {
            // Mark the server as invalid to prevent further attempts
            markServerInvalidMembers(serverId);
            throw new Error(res.error || "Failed to get members");
        }
    } catch (error) {
        logger.error(`[getMembers] Error fetching members for ${serverId}:`, error);

        // Mark the server as invalid if we get a specific error
        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();
            if (
                errorMessage.includes("not found") ||
                errorMessage.includes("does not exist") ||
                errorMessage.includes("cannot read") ||
                errorMessage.includes("internal server error")
            ) {
                markServerInvalidMembers(serverId);
            }
        }

        throw error;
    }
}

// Helper function to mark a server as having invalid members endpoint
function markServerInvalidMembers(serverId: string) {
    try {
        const globalState = useGlobalState.getState();

        // Trigger a fetch that will fail and properly update the state
        globalState.fetchServerMembers(serverId, true)
            .catch(() => {
                logger.info(`[markServerInvalidMembers] Server ${serverId} marked as having invalid members endpoint`);
            });
    } catch (error) {
        logger.warn('[markServerInvalidMembers] Error:', error);
    }
}

export async function updateServer(id: string, name: string, icon: string) {
    logger.info(`[updateServer] Updating server: ${id}`, { name, icon });
    const res = await aofetch(`${id}/update-server`, {
        method: "POST",
        body: {
            name,
            icon
        }
    });
    logger.info(`[updateServer] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[updateServer] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function createCategory(serverId: string, name: string, order?: number) {
    logger.info(`[createCategory] Creating category in server: ${serverId}`, { name, order });
    const body: any = {
        name: name
    };

    // Use order_id instead of order to match the database schema
    if (order !== undefined) {
        body.order_id = order;
    } else {
        body.order_id = 1; // Default value
    }

    logger.info(`[createCategory] Sending request with body:`, body);

    const res = await aofetch(`${serverId}/create-category`, {
        method: "POST",
        body: body
    });
    logger.info(`[createCategory] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[createCategory] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function updateCategory(serverId: string, id: number, name: string, order?: number) {
    logger.info(`[updateCategory] Updating category in server: ${serverId}`, { id, name, order });
    const body: any = {
        id: id,
        name: name
    };

    // Use order_id instead of order to match the database schema
    if (order !== undefined) {
        body.order_id = order;
    }

    logger.info(`[updateCategory] Sending request with body:`, body);

    const res = await aofetch(`${serverId}/update-category`, {
        method: "POST",
        body: body
    });
    logger.info(`[updateCategory] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[updateCategory] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function deleteCategory(serverId: string, id: number) {
    logger.info(`[deleteCategory] Deleting category in server: ${serverId}`, { id });
    const res = await aofetch(`${serverId}/delete-category`, {
        method: "POST",
        body: {
            id
        }
    });
    logger.info(`[deleteCategory] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[deleteCategory] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function createChannel(serverId: string, name: string, categoryId?: number, order?: number) {
    logger.info(`[createChannel] Creating channel in server: ${serverId}`, { name, categoryId, order });
    const body: any = {
        name: name
    };

    if (categoryId !== undefined) {
        body.category_id = categoryId;
    }

    // Only include order_id if explicitly specified
    if (order !== undefined) {
        body.order_id = order;
    }
    // Let the server determine the next appropriate order_id

    logger.info(`[createChannel] Sending request with body:`, body);

    const res = await aofetch(`${serverId}/create-channel`, {
        method: "POST",
        body: body
    });
    logger.info(`[createChannel] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[createChannel] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function updateChannel(serverId: string, id: number, name?: string, categoryId?: number | null, order?: number) {
    logger.info(`[updateChannel] Updating channel in server: ${serverId}`, { id, name, categoryId, order });
    const body: any = {
        id: id
    };

    if (name !== undefined) {
        body.name = name;
    }

    // Only include category_id if it's a valid number or explicitly null/undefined
    if (categoryId !== undefined) {
        if (categoryId === null) {
            // When explicitly setting to null, use an empty string as the backend expects a string or number
            body.category_id = "";
        } else {
            body.category_id = categoryId;
        }
    }

    // Use order_id instead of order to match the database schema
    if (order !== undefined) {
        body.order_id = order;
    }

    logger.info(`[updateChannel] Sending request with body:`, body);

    const res = await aofetch(`${serverId}/update-channel`, {
        method: "POST",
        body: body
    });
    logger.info(`[updateChannel] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[updateChannel] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function deleteChannel(serverId: string, id: number) {
    logger.info(`[deleteChannel] Deleting channel in server: ${serverId}`, { id });
    const res = await aofetch(`${serverId}/delete-channel`, {
        method: "POST",
        body: {
            id
        }
    });
    logger.info(`[deleteChannel] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[deleteChannel] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function getMessages(serverId: string, channelId: number) {
    logger.info(`[getMessages] Fetching messages for channel: ${channelId} in server: ${serverId}`);
    const res = await aofetch(`${serverId}/get-messages`, {
        method: "GET",
        body: {
            channel_id: channelId
        }
    });
    logger.info(`[getMessages] Response:`, res);
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function sendMessage(serverId: string, channelId: number, content: string) {
    logger.info(`[sendMessage] Sending message to channel: ${channelId} in server: ${serverId}`, { content });
    const res = await aofetch(`${serverId}/send-message`, {
        method: "POST",
        body: {
            channel_id: channelId,
            content
        }
    });
    logger.info(`[sendMessage] Response:`, res);
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function editMessage(serverId: string, msgId: string, content: string) {
    logger.info(`[editMessage] Editing message: ${msgId} in server: ${serverId}`, { content });
    const res = await aofetch(`${serverId}/edit-message`, {
        method: "POST",
        body: {
            msg_id: msgId,
            content
        }
    });
    logger.info(`[editMessage] Response:`, res);
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function deleteMessage(serverId: string, msgId: string) {
    logger.info(`[deleteMessage] Deleting message: ${msgId} in server: ${serverId}`);
    const res = await aofetch(`${serverId}/delete-message`, {
        method: "POST",
        body: {
            msg_id: msgId
        }
    });
    logger.info(`[deleteMessage] Response:`, res);
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function updateNickname(serverId: string, nickname: string) {
    logger.info(`[updateNickname] Updating nickname in server: ${serverId}`, { nickname });

    try {
        // Use an empty string if nickname is null or undefined to clear the nickname
        const safeNickname = nickname || "";

        const res = await aofetch(`${serverId}/update-nickname`, {
            method: "POST",
            body: {
                nickname: safeNickname
            }
        });
        logger.info(`[updateNickname] Response:`, res);

        if (res.status == 200) {
            // Directly update local cache for instant UI updates
            try {
                const activeAddress = await window.arweaveWallet.getActiveAddress();
                const globalState = useGlobalState.getState();
                globalState.updateMemberNickname(serverId, activeAddress, safeNickname);
            } catch (error) {
                logger.warn('[updateNickname] Failed to update local cache:', error);
            }

            // Still trigger the standard refresh as a fallback
            try {
                await refreshCurrentServerData();
            } catch (error) {
                logger.warn('[updateNickname] Failed to refresh data:', error);
            }
            return res.json;
        } else {
            logger.error(`[updateNickname] Server error:`, res.error || res.status);
            toast.error("Server does not support nickname updates");
            return { success: false, error: res.error || "Server error" };
        }
    } catch (error) {
        logger.error('[updateNickname] Error updating nickname:', error);
        toast.error("Server does not support nickname updates yet");
        // Return a safe response instead of throwing
        return { success: false, error: "Endpoint not available" };
    }
}

export async function getProfile(address?: string) {
    logger.info(`[getProfile] Fetching profile for:`, address || "current user");
    const res = await aofetch(`${PROFILES}/profile`, {
        method: "GET",
        body: address ? { id: address } : undefined
    });
    logger.info(`[getProfile] Response:`, res);

    if (res.status == 200) {
        // Type assertion to ensure we treat this as a Record
        const profileData = res.json as Record<string, any>;

        // Always try to fetch primary name if address is provided
        if (address) {
            try {
                logger.info(`[getProfile] Fetching primary name for ${address}`);
                const primaryNameData = await ario.getPrimaryName({ address });

                if (primaryNameData && primaryNameData.name) {
                    logger.info(`[getProfile] Found primary name: ${primaryNameData.name}`);

                    // Ensure profile structure exists
                    if (!profileData.profile) {
                        profileData.profile = {};
                    }

                    // Add primaryName to the profile data
                    profileData.primaryName = primaryNameData.name;

                    // Synchronize with the global state immediately
                    try {
                        const globalState = useGlobalState.getState();
                        globalState.updateUserProfileCache(address, {
                            username: profileData.profile?.username,
                            pfp: profileData.profile?.pfp,
                            primaryName: primaryNameData.name,
                            timestamp: Date.now()
                        });
                        logger.info(`[getProfile] Updated user profiles cache with primary name directly`);
                    } catch (syncError) {
                        logger.warn(`[getProfile] Failed to sync primary name to cache:`, syncError);
                    }
                }
            } catch (error) {
                logger.warn(`[getProfile] Failed to fetch primary name:`, error);
                // Continue without primary name
            }
        }

        return profileData;
    } else {
        throw new Error(res.error);
    }
}

export async function updateProfile(username?: string, pfp?: string) {
    logger.info(`[updateProfile] Updating profile:`, { username, pfp });
    const res = await aofetch(`${PROFILES}/update-profile`, {
        method: "POST",
        body: {
            username,
            pfp
        }
    });
    logger.info(`[updateProfile] Response:`, res);
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function joinServer(serverId: string) {
    logger.info(`[joinServer] Joining server: ${serverId}`);
    const res = await aofetch(`${PROFILES}/join-server`, {
        method: "POST",
        body: {
            server_id: serverId
        }
    });
    logger.info(`[joinServer] Response:`, res);
    if (res.status == 200) {
        // Trigger refresh after successful operation
        try {
            await refreshCurrentServerData();
        } catch (error) {
            logger.warn('[joinServer] Failed to refresh data:', error);
        }
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

/**
 * Removes a server from the user's joined servers list
 * @param serverId The server to leave
 */
export async function leaveServer(serverId: string): Promise<boolean> {
    try {
        logger.info(`[leaveServer] Leaving server: ${serverId}`);
        const res = await aofetch(`${PROFILES}/leave-server`, {
            method: "POST",
            body: {
                server_id: serverId
            }
        });
        logger.info(`[leaveServer] Response:`, res);

        if (res.status == 200) {
            // Trigger refresh after successful operation
            try {
                await refreshCurrentServerData();
            } catch (error) {
                logger.warn('[leaveServer] Failed to refresh data:', error);
            }
            return true;
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error("Error leaving server:", error);
        throw error;
    }
}

export async function getNotifications(address: string) {
    logger.info(`[getNotifications] Fetching notifications for address: ${address}`);

    try {
        const res = await aofetch(`${PROFILES}/get-notifications`, {
            method: "GET",
            body: {
                id: address
            }
        });

        logger.info(`[getNotifications] Response:`, res);

        if (res.status == 200) {
            const responseData = res.json as { notifications: any[] };

            if (!responseData.notifications || responseData.notifications.length === 0) {
                logger.info('[getNotifications] No new notifications');
                return {
                    messages: [],
                    isEmpty: true
                };
            }

            // Transform the notifications to match the expected format in the client
            const messages = responseData.notifications.map(notification => ({
                id: notification.message_id,
                recipient: notification.user_id,
                SID: notification.server_id,
                CID: notification.channel_id.toString(),
                MID: notification.message_id,
                author: notification.author_name || notification.author_id,
                content: notification.content || "",
                channel: notification.channel_name,
                server: notification.server_name,
                timestamp: notification.timestamp.toString()
            }));

            logger.info(`[getNotifications] Found ${messages.length} notifications`);

            return {
                messages: messages,
                isEmpty: messages.length === 0
            };
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error("[getNotifications] Error fetching notifications:", error);
        throw error;
    }
}

// Add a new function to mark notifications as read
export async function markNotificationsAsRead(serverId: string, channelId: number) {
    logger.info(`[markNotificationsAsRead] Marking notifications as read for server: ${serverId}, channel: ${channelId}`);

    try {
        const res = await aofetch(`${PROFILES}/mark-read`, {
            method: "POST",
            body: {
                server_id: serverId,
                channel_id: channelId
            }
        });

        logger.info(`[markNotificationsAsRead] Response:`, res);

        if (res.status == 200) {
            return res.json;
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error("[markNotificationsAsRead] Error marking notifications as read:", error);
        throw error;
    }
}