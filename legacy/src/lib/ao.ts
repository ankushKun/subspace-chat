import { aofetch } from "ao-fetch"
import { connect, createDataItemSigner } from "@permaweb/aoconnect"
import { createDataItemSigner as nodeCDIS } from "@permaweb/aoconnect/node"
import { ArconnectSigner, ArweaveSigner, type JWKInterface, createData, DataItem } from "@dha-team/arbundles"

import type { Tag, Member, Server } from "@/lib/types"
import Arweave from "arweave";
import { useGlobalState } from "@/hooks/global-state"; // Import for the refresh function
import { ARIO, type MessageResult } from "@ar.io/sdk";  // Import AR.IO SDK
import { toast } from "sonner";  // Use sonner for toast messages
import { createLogger } from '@/lib/logger'
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet";

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

// Define multiple CU endpoints for fallback
const CU_ENDPOINTS = [
    "https://cu.arnode.asia",
    "https://cu.ardrive.io",
];

// Track the current endpoint index
let currentEndpointIndex = 0;

// Create AO connection with the primary endpoint
let ao = connect({
    MODE: "legacy",
    CU_URL: CU_ENDPOINTS[currentEndpointIndex],
});

function getConnectionStrategy() {
    const connectionStrategy = JSON.parse(localStorage.getItem("subspace-conn-strategy") || '""')
    if (connectionStrategy == ConnectionStrategies.JWK) {
        const jwk = JSON.parse(localStorage.getItem("subspace-jwk") || '{}')
        return {
            strategy: "jwk",
            jwk: jwk
        }
    }
    return { strategy: connectionStrategy }
}

function getAOSigner() {
    const connectionStrategy = getConnectionStrategy()
    if (connectionStrategy.strategy == ConnectionStrategies.JWK) {
        const jwk = connectionStrategy.jwk
        const newSigner = async (create, createDataItem = (buf) => new DataItem(buf)) => {
            console.log("create", create)
            console.log("createDataItem", createDataItem)

            const { data, tags, target, anchor } = await create({ alg: 'rsa-v1_5-sha256', passthrough: true })

            const signer = async ({ data, tags, target, anchor }) => {
                console.log("data", data)
                console.log("tags", tags)
                console.log("target", target)
                console.log("anchor", anchor)
                const signer = new ArweaveSigner(jwk)
                const dataItem = createData(data, signer, { tags, target, anchor })
                return dataItem.sign(signer)
                    .then(async () => ({
                        id: await dataItem.id,
                        raw: await dataItem.getRaw()
                    }))
            }

            return signer({ data, tags, target, anchor })
        }
        return newSigner
    }
    return createDataItemSigner(window.arweaveWallet)
}

// Function to switch to the next endpoint when we encounter connection issues
function switchToNextEndpoint() {
    // Update the endpoint index
    currentEndpointIndex = (currentEndpointIndex + 1) % CU_ENDPOINTS.length;
    logger.info(`[switchToNextEndpoint] Switching to endpoint: ${CU_ENDPOINTS[currentEndpointIndex]}`);

    // Recreate the connection with the new endpoint
    ao = connect({
        MODE: "legacy",
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
    });
}

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
    logger.info("Spawning server...", { name, icon: icon?.name || "none" });

    let data: any;
    let tags = [
        ...CommonTags,
        { name: "Name", value: name },
    ];
    // Read the file as an ArrayBuffer properly
    if (icon) {
        data = await to(icon);
        logger.info("Icon array buffer created", data.byteLength, icon.type);
        tags.push({ name: "Content-Type", value: icon.type })
    }

    const serverId = await ao.spawn({
        scheduler: SCHEDULER,
        module: MODULE,
        signer: getAOSigner(),
        tags,
        data
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
    const signer = getAOSigner()
    const updateServerRes = await aofetch(`${serverId}/update-server`, {
        method: "POST",
        body: {
            name: name,
            icon: serverId
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: signer
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
    logger.info("Running lua", code.slice(0, 100), "...");

    if (tags) {
        tags = [...CommonTags, ...tags];
    } else {
        tags = CommonTags;
    }

    tags = [...tags, { name: "Action", value: "Eval" }];

    // Get a fresh signer each time
    const currentSigner = getAOSigner();

    const message = await ao.message({
        process,
        data: code,
        signer: currentSigner,
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

    const connectionStrategy = getConnectionStrategy()

    const fileData = await to(file);
    logger.info(`[uploadWithStandardArweave] File converted to Uint8Array:`, fileData.byteLength);

    const tx = await ar.createTransaction({ data: fileData }, connectionStrategy.strategy == ConnectionStrategies.JWK ? connectionStrategy.jwk : "use_wallet");
    logger.info(`[uploadWithStandardArweave] Transaction created:`, tx.id);

    tx.addTag("Content-Type", file.type);
    tx.addTag("App-Name", "Subspace-Chat");
    // @ts-ignore
    tx.addTag("App-Version", window.APP_VERSION);

    logger.info(`[uploadWithStandardArweave] Signing transaction...`);
    await ar.transactions.sign(tx, connectionStrategy.strategy == ConnectionStrategies.JWK ? connectionStrategy.jwk : "use_wallet");
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
        CU_URL: CU_ENDPOINTS[currentEndpointIndex]
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

    // Improved retry logic with more attempts and exponential backoff
    const maxRetries = 5; // Increased from 3 to 5
    const baseRetryDelay = 1000; // Start with 1 second

    // Define network-related errors that should be retried
    const retryableErrorPatterns = [
        'network error', 'timeout', 'connection', 'socket',
        'offline', 'failed to fetch', 'aborted', 'interrupted',
        'etimedout', 'econnrefused', 'econnreset', 'dns',
        'service unavailable', '429', '500', '502', '503', '504'
    ];

    let endpointSwitchAttempted = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Create a promise that will reject after a timeout
            const fetchWithTimeout = async () => {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Request timed out')), 10000);
                });

                // Race the fetch against the timeout
                return Promise.race([
                    aofetch(`${id}/`, {
                        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
                    }),
                    timeoutPromise
                ]);
            };

            // Type assertion for the response
            const res = await fetchWithTimeout() as {
                status: number;
                error?: string;
                json: any;
            };

            logger.info(`[getServerInfo] Response on attempt ${attempt}:`, res);

            if (res.status == 200) {
                return res.json;
            } else {
                // Only fail immediately on clear "not found" or "forbidden" errors
                if (res.status === 404 || res.status === 403) {
                    throw new Error(res.error || `Server returned ${res.status}`);
                }

                // For other status codes, retry
                throw new Error(`Server returned status ${res.status}: ${res.error || 'Unknown error'}`);
            }
        } catch (error) {
            const errorStr = String(error).toLowerCase();

            // Check if this is a fatal error that shouldn't be retried
            const isFatalError = errorStr.includes("not found") ||
                errorStr.includes("does not exist") ||
                errorStr.includes("forbidden");

            // Check if this is a network error that should be retried
            const isNetworkError = retryableErrorPatterns.some(pattern =>
                errorStr.includes(pattern.toLowerCase())
            );

            // If we encounter a network error, try switching endpoints
            if (isNetworkError && !endpointSwitchAttempted) {
                logger.info(`[getServerInfo] Switching endpoints due to network error: ${errorStr}`);
                switchToNextEndpoint();
                endpointSwitchAttempted = true;
                // Don't count this attempt against the retry limit since we're switching endpoints
                attempt--;
                continue;
            }

            // If it's the last attempt or a fatal error, throw
            if (attempt === maxRetries || (isFatalError && !isNetworkError)) {
                logger.error(`[getServerInfo] Failed after ${attempt} attempts for server ${id}:`, error);
                throw error;
            }

            // Use exponential backoff for retry delay
            const retryDelay = baseRetryDelay * Math.pow(1.5, attempt - 1);
            logger.warn(`[getServerInfo] Attempt ${attempt} failed for server ${id}, retrying in ${retryDelay}ms:`, error);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    // If we got here, all retries failed
    throw new Error("Failed to connect to server after multiple attempts");
}

// Global request tracking to persist across the entire application
const memberRequestLimiter = {
    serverRequests: new Map<string, number>(),
    lastAttemptTimes: new Map<string, number>(),
    pendingRequests: new Map<string, Promise<any>>(),
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

    // Get or create a promise for this server to deduplicate concurrent requests
    getOrCreateRequest: function (serverId: string, createFn: () => Promise<any>) {
        // If we already have a pending request for this server, return it
        if (this.pendingRequests.has(serverId)) {
            return this.pendingRequests.get(serverId)!;
        }

        // Create a new promise
        const promise = createFn();

        // Store it in our map
        this.pendingRequests.set(serverId, promise);

        // Clean up after the promise resolves or rejects
        promise.finally(() => {
            this.pendingRequests.delete(serverId);
        });

        return promise;
    }
};

export async function getMembers(serverId: string) {
    logger.info(`[getMembers] Fetching members for server: ${serverId}`);

    // Check if we've exceeded request limits for rate limiting only
    if (memberRequestLimiter.isServerBlocked(serverId)) {
        logger.info(`[getMembers] Server ${serverId} is blocked from further requests due to rate limiting`);
        throw new Error("Rate limit exceeded for member requests to this server");
    }

    // Use the getOrCreateRequest function to deduplicate concurrent requests
    return memberRequestLimiter.getOrCreateRequest(serverId, async () => {
        // Record this attempt
        memberRequestLimiter.recordAttempt(serverId);

        try {
            // Check global state cache first
            const cachedMembers = useGlobalState.getState().getServerMembers(serverId);
            if (cachedMembers && cachedMembers.length > 0) {
                logger.info(`[getMembers] Using cached members for ${serverId}`);
                return { success: true, members: cachedMembers };
            }

            const res = await aofetch(`${serverId}/get-members`, {
                CU_URL: CU_ENDPOINTS[currentEndpointIndex],
            });
            logger.info(`[getMembers] Response:`, res);

            if (res.status == 200) {
                // Cache the successful result
                try {
                    const globalState = useGlobalState.getState();
                    if (res.json && typeof res.json === 'object' && 'members' in res.json) {
                        const now = Date.now();
                        const membersResponse = res.json as { members: Member[] };
                        globalState.serverMembers.set(serverId, {
                            data: membersResponse.members,
                            timestamp: now
                        });
                    }
                } catch (error) {
                    logger.warn('[getMembers] Error caching members:', error);
                }

                return res.json;
            } else {
                throw new Error(res.error || "Failed to get members");
            }
        } catch (error) {
            logger.error(`[getMembers] Error fetching members for ${serverId}:`, error);
            throw error;
        }
    });
}

export async function updateServer(id: string, name: string, icon: string) {
    logger.info(`[updateServer] Updating server: ${id}`, { name, icon });
    const res = await aofetch(`${id}/update-server`, {
        method: "POST",
        body: {
            name,
            icon
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        body: body,
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        body: body,
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        body: body,
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        body: body,
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
            },
            CU_URL: CU_ENDPOINTS[currentEndpointIndex],
            signer: getAOSigner()
        });
        logger.info(`[updateNickname] Response:`, res);

        if (res.status == 200) {
            // Directly update local cache for instant UI updates
            try {
                const { address } = useWallet();
                const globalState = useGlobalState.getState();
                globalState.updateMemberNickname(serverId, address, safeNickname);
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
        body: address ? { id: address } : undefined,
        CU_URL: CU_ENDPOINTS[currentEndpointIndex]
    });
    logger.info(`[getProfile] Response:`, res);

    if (res.status == 200) {
        // Type assertion to ensure we treat this as a Record
        const profileData = res.json as Record<string, any>;

        // Always try to fetch primary name if address is provided
        if (profileData.profile?.original_id || address) {
            const originalAddress = profileData.profile?.original_id ?? address;
            try {
                logger.info(`[getProfile] Fetching primary name for ${originalAddress}`);
                const primaryNameData = await ario.getPrimaryName({ address: originalAddress });

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
                        globalState.updateUserProfileCache(originalAddress, {
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

/**
 * Fetches multiple user profiles in a single request to improve performance
 * @param addresses Array of user addresses to fetch profiles for
 * @returns Object containing all fetched profiles
 */
export async function getBulkProfiles(addresses: string[]) {
    if (!addresses || addresses.length === 0) {
        logger.warn(`[getBulkProfiles] No addresses provided`);
        return { profiles: [] };
    }

    // Remove any duplicate addresses to optimize the request
    const uniqueAddresses = [...new Set(addresses)];

    logger.info(`[getBulkProfiles] Fetching profiles for ${uniqueAddresses.length} users`);
    // Convert the array to a JSON string to ensure proper serialization
    const res = await aofetch(`${PROFILES}/bulk-profile`, {
        method: "GET",
        body: {
            ids: JSON.stringify(uniqueAddresses)
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
    });
    logger.info(`[getBulkProfiles] Response status:`, res.status);

    if (res.status == 200) {
        const profilesData = res.json as { success: boolean, profiles: any[] };

        // Cache all the profiles in the global state
        if (profilesData.profiles && profilesData.profiles.length > 0) {
            try {
                const globalState = useGlobalState.getState();
                const now = Date.now();

                // First cache the basic profile data immediately
                profilesData.profiles.forEach(profile => {
                    if (!profile.id) return;

                    // Update the profiles cache with basic data first
                    globalState.updateUserProfileCache(profile.id, {
                        username: profile.username,
                        pfp: profile.pfp,
                        timestamp: now
                    });
                });

                // Then fetch primary names in the background
                profilesData.profiles.forEach(async (profile) => {
                    if (!profile.id) return;

                    try {
                        // Get the existing profile data before updating
                        const existingProfile = globalState.getUserProfileFromCache(profile.id);

                        // Only fetch primary name if we don't already have it cached
                        if (!existingProfile?.primaryName) {
                            const primaryNameData = await ario.getPrimaryName({ address: profile.id });
                            const primaryName = primaryNameData?.name;

                            if (primaryName) {
                                // Update just the primary name without changing other data
                                const updatedProfile = {
                                    ...existingProfile,
                                    primaryName,
                                    timestamp: Date.now()
                                };
                                globalState.updateUserProfileCache(profile.id, updatedProfile);

                                // Also add the primary name to the returned profile data
                                profile.primaryName = primaryName;
                            }
                        } else {
                            // If we already have primary name, add it to the returned profile data
                            profile.primaryName = existingProfile.primaryName;
                        }
                    } catch (error) {
                        // Just log the error but don't let it stop other processing
                        logger.warn(`[getBulkProfiles] Failed to fetch primary name for ${profile.id}:`, error);
                    }
                });

                logger.info(`[getBulkProfiles] Successfully cached ${profilesData.profiles.length} profiles`);
            } catch (error) {
                logger.warn(`[getBulkProfiles] Error caching profiles:`, error);
            }
        }

        return profilesData;
    } else {
        logger.error(`[getBulkProfiles] Error fetching profiles:`, res.error);
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
        },
        CU_URL: CU_ENDPOINTS[currentEndpointIndex],
        signer: getAOSigner()
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
            },
            CU_URL: CU_ENDPOINTS[currentEndpointIndex],
            signer: getAOSigner()
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

/**
 * Delegates an address to be used as an alias for the current user's address
 * @param delegatedId The address to be delegated
 */
export async function delegate(delegatedId: string): Promise<boolean> {
    try {
        logger.info(`[delegate] Delegating address: ${delegatedId}`);
        const res = await aofetch(`${PROFILES}/delegate`, {
            method: "POST",
            body: {
                delegated_id: delegatedId
            },
            CU_URL: CU_ENDPOINTS[currentEndpointIndex],
            signer: getAOSigner()
        });
        logger.info(`[delegate] Response:`, res);

        if (res.status == 200) {
            return true;
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error("[delegate] Error delegating address:", error);
        throw error;
    }
}

/**
 * Removes a delegation for an address
 * @param delegatedId The delegated address to remove
 */
export async function undelegate(delegatedId: string): Promise<boolean> {
    try {
        logger.info(`[undelegate] Removing delegation for address: ${delegatedId}`);
        const res = await aofetch(`${PROFILES}/undelegate`, {
            method: "POST",
            body: {
                delegated_id: delegatedId
            },
            CU_URL: CU_ENDPOINTS[currentEndpointIndex],
            signer: getAOSigner()
        });
        logger.info(`[undelegate] Response:`, res);

        if (res.status == 200) {
            return true;
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error("[undelegate] Error removing delegation:", error);
        throw error;
    }
}

// Notification request tracking and caching
const notificationCache = {
    // Cache for notification data by address
    data: new Map<string, {
        notifications: any,
        timestamp: number
    }>(),

    // Active request tracking
    pendingRequests: new Map<string, Promise<any>>(),

    // Request rate limiting
    lastRequestTime: new Map<string, number>(),

    // Configuration
    MIN_REQUEST_INTERVAL: 4000, // 4 seconds minimum between requests
    CACHE_TTL: 10000, // 10 seconds TTL for cache

    // Check if we should throttle requests for this address
    shouldThrottle(address: string): boolean {
        const lastRequest = this.lastRequestTime.get(address) || 0;
        return (Date.now() - lastRequest) < this.MIN_REQUEST_INTERVAL;
    },

    // Get cached data if still valid
    getCachedData(address: string): any | null {
        const cached = this.data.get(address);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            logger.info(`[notificationCache] Using cached notifications for ${address}, age: ${Date.now() - cached.timestamp}ms`);
            return cached.notifications;
        }
        return null;
    },

    // Store data in cache
    setCachedData(address: string, data: any): void {
        this.data.set(address, {
            notifications: data,
            timestamp: Date.now()
        });
        logger.info(`[notificationCache] Updated cache for ${address}`);
    },

    // Record request time
    recordRequest(address: string): void {
        this.lastRequestTime.set(address, Date.now());
    },

    // Get or create a promise for this request
    getOrCreateRequest(address: string, createFn: () => Promise<any>): Promise<any> {
        // If we already have a pending request, return it
        if (this.pendingRequests.has(address)) {
            logger.info(`[notificationCache] Reusing pending request for ${address}`);
            return this.pendingRequests.get(address)!;
        }

        // Create a new promise
        const promise = createFn().finally(() => {
            // Remove from pending on completion
            this.pendingRequests.delete(address);
        });

        // Store in pending requests
        this.pendingRequests.set(address, promise);
        return promise;
    }
};

export async function getNotifications(address: string) {
    logger.info(`[getNotifications] Fetching notifications for address: ${address}`);

    // Check cache first
    const cachedData = notificationCache.getCachedData(address);
    if (cachedData) {
        return cachedData;
    }

    // Check if we should throttle
    if (notificationCache.shouldThrottle(address)) {
        logger.info(`[getNotifications] Throttling request for ${address}, using cache or empty result`);
        // If throttled, return cache even if expired, or empty result
        return cachedData || {
            messages: [],
            isEmpty: true
        };
    }

    // Record this request attempt
    notificationCache.recordRequest(address);

    // Use the request deduplication system
    return notificationCache.getOrCreateRequest(address, async () => {
        try {
            const res = await aofetch(`${PROFILES}/get-notifications`, {
                method: "GET",
                body: {
                    id: address
                },
                CU_URL: CU_ENDPOINTS[currentEndpointIndex],
            });

            logger.info(`[getNotifications] Response status:`, res.status);

            if (res.status == 200) {
                const responseData = res.json as { notifications: any[] };

                if (!responseData.notifications || responseData.notifications.length === 0) {
                    logger.info('[getNotifications] No new notifications');
                    const result = {
                        messages: [],
                        isEmpty: true
                    };

                    // Cache the empty result
                    notificationCache.setCachedData(address, result);
                    return result;
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

                const result = {
                    messages: messages,
                    isEmpty: messages.length === 0
                };

                // Cache the successful result
                notificationCache.setCachedData(address, result);
                return result;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            logger.error("[getNotifications] Error fetching notifications:", error);
            throw error;
        }
    });
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
            },
            CU_URL: CU_ENDPOINTS[currentEndpointIndex],
            signer: getAOSigner()
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

/**
 * Checks the delegation status for an address
 * @param address Optional address to check, defaults to current user's address
 * @returns Object containing delegation information
 */
export async function checkDelegation(address?: string) {
    try {
        logger.info(`[checkDelegation] Checking delegation status for:`, address || "current user");
        const res = await aofetch(`${PROFILES}/check-delegation`, {
            method: "GET",
            body: address ? { id: address } : undefined,
            CU_URL: CU_ENDPOINTS[currentEndpointIndex]
        });
        logger.info(`[checkDelegation] Response:`, res);

        if (res.status == 200) {
            return res.json;
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error("[checkDelegation] Error checking delegation:", error);
        throw error;
    }
}

interface ServerVersionResponse {
    success: boolean;
    version: string;
}

interface SingleMemberResponse {
    success: boolean;
    member: Member | null;
}

/**
 * Gets the version of a server
 * @param serverId The server to get version for
 */
export async function getServerVersion(serverId: string): Promise<string> {
    try {
        logger.info(`[getServerVersion] Getting version for server: ${serverId}`);
        const res = await aofetch(`${serverId}/get-version`, {
            method: "GET",
            CU_URL: CU_ENDPOINTS[currentEndpointIndex]
        });
        logger.info(`[getServerVersion] Response:`, res);

        if (res.status == 200) {
            const response = res.json as ServerVersionResponse;
            return response.version;
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error("[getServerVersion] Error getting server version:", error);
        throw error;
    }
}

/**
 * Gets a single member's data from a server
 * @param serverId The server to get member from
 * @param memberId The member's ID to fetch
 */
export async function getSingleMember(serverId: string, memberId: string): Promise<Member | null> {
    try {
        logger.info(`[getSingleMember] Getting member ${memberId} from server: ${serverId}`);
        const res = await aofetch(`${serverId}/single-member`, {
            method: "GET",
            body: {
                id: memberId
            },
            CU_URL: CU_ENDPOINTS[currentEndpointIndex]
        });
        logger.info(`[getSingleMember] Response:`, res);

        if (res.status == 200) {
            const response = res.json as SingleMemberResponse;
            return response.member;
        } else {
            throw new Error(res.error);
        }
    } catch (error) {
        logger.error(`[getSingleMember] Error getting member data:`, error);
        return null;
    }
}