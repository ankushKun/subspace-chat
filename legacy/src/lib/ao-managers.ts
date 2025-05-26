import { aofetch } from "ao-fetch"
import { connect, createDataItemSigner } from "@permaweb/aoconnect"
import { ArconnectSigner, ArweaveSigner, type JWKInterface, createData, DataItem } from "@dha-team/arbundles/web"
import type { MessageResult } from "node_modules/@permaweb/aoconnect/dist/lib/result";
import type { Tag, Member, Server } from "@/lib/types"
import Arweave from "arweave";
import { useGlobalState } from "@/hooks/global-state";
import { ARIO } from "@ar.io/sdk";
import { toast } from "sonner";
import { createLogger } from '@/lib/logger'
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet";

// Types and Interfaces
interface ServerVersionResponse {
    success: boolean;
    version: string;
}

interface SingleMemberResponse {
    success: boolean;
    member: Member | null;
}

interface NotificationCacheData {
    notifications: any;
    timestamp: number;
}

interface MemberRequestLimiterConfig {
    serverRequests: Map<string, number>;
    lastAttemptTimes: Map<string, number>;
    pendingRequests: Map<string, Promise<any>>;
    MIN_REQUEST_INTERVAL: number;
    MAX_REQUESTS_PER_SERVER: number;
}

// ✅
// Constants
export class AOConstants {
    static readonly SCHEDULER = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA";
    static readonly MODULE = "33d-3X8mpv6xYBlVB-eXMrPfH5Kzf6Hiwhcv0UA10sw";
    static readonly PROFILES = "J-GI_SARbZ8O0km4JiE2lu2KJdZIWMo53X3HrqusXjY";

    // @ts-ignore
    static readonly SERVER_SOURCE = `${__SERVER_SRC__}`;
    // @ts-ignore
    static readonly AOXPRESS_SOURCE = `${__AOXPRESS_SRC__}`;

    static readonly CU_ENDPOINTS = [
        "https://cu.arnode.asia",
        "https://cu.ardrive.io",
    ];

    static readonly COMMON_TAGS: Tag[] = [
        { name: "App-Name", value: "Subspace-Chat" },
        // @ts-ignore
        { name: "App-Version", value: __APP_VERSION__ || "DEV" },
        { name: 'Authority', value: 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY' },
    ];
}

// Connection and Authentication Manager
export class ConnectionManager {
    private logger = createLogger('ConnectionManager');
    private currentEndpointIndex = 0;
    private ao: any;
    private ario = ARIO.mainnet();

    constructor() {
        this.ao = connect({
            MODE: "legacy",
            CU_URL: AOConstants.CU_ENDPOINTS[this.currentEndpointIndex],
        });
    }

    getConnectionStrategy() {
        const connectionStrategy = JSON.parse(localStorage.getItem("subspace-conn-strategy") || '""');
        if (connectionStrategy == ConnectionStrategies.JWK) {
            const jwk = JSON.parse(localStorage.getItem("subspace-jwk") || '{}');
            return {
                strategy: "jwk",
                jwk: jwk
            };
        }
        return { strategy: connectionStrategy };
    }

    getAOSigner() {
        const connectionStrategy = this.getConnectionStrategy();
        if (connectionStrategy.strategy == ConnectionStrategies.JWK) {
            const jwk = connectionStrategy.jwk;
            const newSigner = async (create: any, createDataItem = (buf: any) => new DataItem(buf)) => {
                const { data, tags, target, anchor } = await create({ alg: 'rsa-v1_5-sha256', passthrough: true });

                const signer = async ({ data, tags, target, anchor }: any) => {
                    const signer = new ArweaveSigner(jwk);
                    const dataItem = createData(data, signer, { tags, target, anchor });
                    return dataItem.sign(signer)
                        .then(async () => ({
                            id: await dataItem.id,
                            raw: await dataItem.getRaw()
                        }));
                };

                return signer({ data, tags, target, anchor });
            };
            return newSigner;
        }
        return createDataItemSigner(window.arweaveWallet);
    }

    switchToNextEndpoint() {
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % AOConstants.CU_ENDPOINTS.length;
        this.logger.info(`Switching to endpoint: ${AOConstants.CU_ENDPOINTS[this.currentEndpointIndex]}`);

        this.ao = connect({
            MODE: "legacy",
            CU_URL: AOConstants.CU_ENDPOINTS[this.currentEndpointIndex],
        });
    }

    getCurrentEndpoint(): string {
        return AOConstants.CU_ENDPOINTS[this.currentEndpointIndex];
    }

    getAOConnection() {
        return this.ao;
    }

    getARIOClient() {
        return this.ario;
    }
}

// Utility Manager
export class UtilityManager {
    private logger = createLogger('UtilityManager');

    constructor(private connectionManager: ConnectionManager) { }

    async runLua(code: string, process: string, tags?: Tag[]): Promise<MessageResult> {
        this.logger.info("Running lua", code.slice(0, 100), "...");

        if (tags) {
            tags = [...AOConstants.COMMON_TAGS, ...tags];
        } else {
            tags = AOConstants.COMMON_TAGS;
        }

        tags = [...tags, { name: "Action", value: "Eval" }];

        const currentSigner = this.connectionManager.getAOSigner();
        const ao = this.connectionManager.getAOConnection();

        const message = await ao.message({
            process,
            data: code,
            signer: currentSigner,
            tags,
        });

        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await ao.result({ process, message });
        (result as any).id = message;
        return result;
    }

    parseOutput(msg: MessageResult) {
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

    async refreshCurrentServerData() {
        try {
            const globalState = useGlobalState.getState();
            return await globalState.refreshServerData();
        } catch (error) {
            this.logger.error("Failed to refresh server data:", error);
            throw new Error("Failed to refresh server data. Please try again or reload the application.");
        }
    }

    fileToUint8Array(file: File): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(new Uint8Array(reader.result as ArrayBuffer));
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }
}

// File Manager
export class FileManager {
    private logger = createLogger('FileManager');

    constructor(
        private connectionManager: ConnectionManager,
        private utilityManager: UtilityManager
    ) { }

    async uploadFileAndGetId(file: File): Promise<string> {
        this.logger.info(`Uploading file:`, file.name, file.size, file.type);

        try {
            const fileId = await this.uploadWithStandardArweave(file);
            this.logger.info(`File uploaded successfully:`, fileId);
            return fileId;
        } catch (error) {
            this.logger.error(`Upload failed:`, error);
            throw error;
        }
    }

    private async uploadWithStandardArweave(file: File): Promise<string> {
        this.logger.info(`Starting upload:`, file.name);
        const ar = Arweave.init({
            host: "arweave.net",
            port: 443,
            protocol: "https",
        });

        const connectionStrategy = this.connectionManager.getConnectionStrategy();
        const fileData = await this.utilityManager.fileToUint8Array(file);
        this.logger.info(`File converted to Uint8Array:`, fileData.byteLength);

        const tx = await ar.createTransaction({ data: fileData }, connectionStrategy.strategy == ConnectionStrategies.JWK ? connectionStrategy.jwk : "use_wallet");
        this.logger.info(`Transaction created:`, tx.id);

        tx.addTag("Content-Type", file.type);
        tx.addTag("App-Name", "Subspace-Chat");
        // @ts-ignore
        tx.addTag("App-Version", window.APP_VERSION);

        this.logger.info(`Signing transaction...`);
        await ar.transactions.sign(tx, connectionStrategy.strategy == ConnectionStrategies.JWK ? connectionStrategy.jwk : "use_wallet");
        this.logger.info(`Transaction signed, posting...`);

        const res = await ar.transactions.post(tx);
        this.logger.info(`Transaction posted, status:`, res.status);

        if (res.status == 200) {
            return tx.id;
        } else {
            throw new Error(res.statusText);
        }
    }
}

// Server Manager
export class ServerManager {
    private logger = createLogger('ServerManager');

    constructor(
        private connectionManager: ConnectionManager,
        private utilityManager: UtilityManager,
        private fileManager: FileManager
    ) { }

    async createServer(name: string, icon: File): Promise<string> {
        this.logger.info("Spawning server...", { name, icon: icon?.name || "none" });

        let data: any;
        let tags = [
            ...AOConstants.COMMON_TAGS,
            { name: "Name", value: name },
        ];

        if (icon) {
            data = await this.utilityManager.fileToUint8Array(icon);
            this.logger.info("Icon array buffer created", data.byteLength, icon.type);
            tags.push({ name: "Content-Type", value: icon.type });
        }

        const ao = this.connectionManager.getAOConnection();
        const serverId = await ao.spawn({
            scheduler: AOConstants.SCHEDULER,
            module: AOConstants.MODULE,
            signer: this.connectionManager.getAOSigner(),
            tags,
            data
        });

        this.logger.info("Got server id", serverId);

        this.logger.info("Loading aoxpress...");
        const aoxpressRes = await this.utilityManager.runLua(AOConstants.AOXPRESS_SOURCE, serverId);
        this.logger.info("AoXpress result:", await this.utilityManager.parseOutput(aoxpressRes));

        this.logger.info("Initializing server...");
        const initServerRes = await this.utilityManager.runLua(AOConstants.SERVER_SOURCE, serverId);
        this.logger.info("Server initialization result:", await this.utilityManager.parseOutput(initServerRes));

        this.logger.info("Updating server details...");
        const updateServerRes = await aofetch(`${serverId}/update-server`, {
            method: "POST",
            body: { name: name, icon: serverId },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        if (updateServerRes.status !== 200) {
            throw new Error(updateServerRes.error);
        }

        // Join the server automatically
        const serverJoinManager = new ServerJoinManager(this.connectionManager, this.utilityManager);
        await serverJoinManager.joinServer(serverId);

        return serverId;
    }

    async getServerInfo(id: string) {
        this.logger.info(`Fetching server info for: ${id}`);

        const maxRetries = 5;
        const baseRetryDelay = 1000;
        const retryableErrorPatterns = [
            'network error', 'timeout', 'connection', 'socket',
            'offline', 'failed to fetch', 'aborted', 'interrupted',
            'etimedout', 'econnrefused', 'econnreset', 'dns',
            'service unavailable', '429', '500', '502', '503', '504'
        ];

        let endpointSwitchAttempted = false;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const fetchWithTimeout = async () => {
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('Request timed out')), 10000);
                    });

                    return Promise.race([
                        aofetch(`${id}/`, {
                            CU_URL: this.connectionManager.getCurrentEndpoint(),
                        }),
                        timeoutPromise
                    ]);
                };

                const res = await fetchWithTimeout() as {
                    status: number;
                    error?: string;
                    json: any;
                };

                this.logger.info(`Response on attempt ${attempt}:`, res);

                if (res.status == 200) {
                    return res.json;
                }

                if (res.status === 404 || res.status === 403) {
                    throw new Error(res.error || `Server returned ${res.status}`);
                }

                throw new Error(`Server returned status ${res.status}: ${res.error || 'Unknown error'}`);
            } catch (error) {
                const errorStr = String(error).toLowerCase();
                const isFatalError = errorStr.includes("not found") || errorStr.includes("does not exist") || errorStr.includes("forbidden");
                const isNetworkError = retryableErrorPatterns.some(pattern => errorStr.includes(pattern.toLowerCase()));

                if (isNetworkError && !endpointSwitchAttempted) {
                    this.logger.info(`Switching endpoints due to network error: ${errorStr}`);
                    this.connectionManager.switchToNextEndpoint();
                    endpointSwitchAttempted = true;
                    attempt--;
                    continue;
                }

                if (attempt === maxRetries || (isFatalError && !isNetworkError)) {
                    this.logger.error(`Failed after ${attempt} attempts for server ${id}:`, error);
                    throw error;
                }

                const retryDelay = baseRetryDelay * Math.pow(1.5, attempt - 1);
                this.logger.warn(`Attempt ${attempt} failed for server ${id}, retrying in ${retryDelay}ms:`, error);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        throw new Error("Failed to connect to server after multiple attempts");
    }

    async updateServer(id: string, name: string, icon: string) {
        this.logger.info(`Updating server: ${id}`, { name, icon });
        const res = await aofetch(`${id}/update-server`, {
            method: "POST",
            body: { name, icon },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async getServerVersion(serverId: string): Promise<string> {
        try {
            this.logger.info(`Getting version for server: ${serverId}`);
            const res = await aofetch(`${serverId}/get-version`, {
                method: "GET",
                CU_URL: this.connectionManager.getCurrentEndpoint()
            });

            this.logger.info(`Response:`, res);
            if (res.status == 200) {
                const response = res.json as ServerVersionResponse;
                return response.version;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            this.logger.error("Error getting server version:", error);
            throw error;
        }
    }
}

// Category Manager
export class CategoryManager {
    private logger = createLogger('CategoryManager');

    constructor(
        private connectionManager: ConnectionManager,
        private utilityManager: UtilityManager
    ) { }

    async createCategory(serverId: string, name: string, order?: number) {
        this.logger.info(`Creating category in server: ${serverId}`, { name, order });
        const body: any = {
            name: name,
            order_id: order !== undefined ? order : 1
        };

        const res = await aofetch(`${serverId}/create-category`, {
            method: "POST",
            body: body,
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async updateCategory(serverId: string, id: number, name: string, order?: number) {
        this.logger.info(`Updating category in server: ${serverId}`, { id, name, order });
        const body: any = {
            id: id,
            name: name
        };

        if (order !== undefined) {
            body.order_id = order;
        }

        const res = await aofetch(`${serverId}/update-category`, {
            method: "POST",
            body: body,
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async deleteCategory(serverId: string, id: number) {
        this.logger.info(`Deleting category in server: ${serverId}`, { id });
        const res = await aofetch(`${serverId}/delete-category`, {
            method: "POST",
            body: { id },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }
}

// Channel Manager
export class ChannelManager {
    private logger = createLogger('ChannelManager');

    constructor(
        private connectionManager: ConnectionManager,
        private utilityManager: UtilityManager
    ) { }

    async createChannel(serverId: string, name: string, categoryId?: number, order?: number) {
        this.logger.info(`Creating channel in server: ${serverId}`, { name, categoryId, order });
        const body: any = { name: name };

        if (categoryId !== undefined) {
            body.category_id = categoryId;
        }

        if (order !== undefined) {
            body.order_id = order;
        }

        const res = await aofetch(`${serverId}/create-channel`, {
            method: "POST",
            body: body,
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async updateChannel(serverId: string, id: number, name?: string, categoryId?: number | null, order?: number) {
        this.logger.info(`Updating channel in server: ${serverId}`, { id, name, categoryId, order });
        const body: any = { id: id };

        if (name !== undefined) {
            body.name = name;
        }

        if (categoryId !== undefined) {
            if (categoryId === null) {
                body.category_id = "";
            } else {
                body.category_id = categoryId;
            }
        }

        if (order !== undefined) {
            body.order_id = order;
        }

        const res = await aofetch(`${serverId}/update-channel`, {
            method: "POST",
            body: body,
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async deleteChannel(serverId: string, id: number) {
        this.logger.info(`Deleting channel in server: ${serverId}`, { id });
        const res = await aofetch(`${serverId}/delete-channel`, {
            method: "POST",
            body: { id },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }
}

// Message Manager
export class MessageManager {
    private logger = createLogger('MessageManager');

    constructor(private connectionManager: ConnectionManager) { }

    async getMessages(serverId: string, channelId: number) {
        this.logger.info(`Fetching messages for channel: ${channelId} in server: ${serverId}`);
        const res = await aofetch(`${serverId}/get-messages`, {
            method: "GET",
            body: { channel_id: channelId },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async sendMessage(serverId: string, channelId: number, content: string) {
        this.logger.info(`Sending message to channel: ${channelId} in server: ${serverId}`, { content });
        const res = await aofetch(`${serverId}/send-message`, {
            method: "POST",
            body: { channel_id: channelId, content },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async editMessage(serverId: string, msgId: string, content: string) {
        this.logger.info(`Editing message: ${msgId} in server: ${serverId}`, { content });
        const res = await aofetch(`${serverId}/edit-message`, {
            method: "POST",
            body: { msg_id: msgId, content },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async deleteMessage(serverId: string, msgId: string) {
        this.logger.info(`Deleting message: ${msgId} in server: ${serverId}`);
        const res = await aofetch(`${serverId}/delete-message`, {
            method: "POST",
            body: { msg_id: msgId },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }
}

// Member Manager
export class MemberManager {
    private logger = createLogger('MemberManager');
    private requestLimiter: MemberRequestLimiterConfig;

    constructor(
        private connectionManager: ConnectionManager,
        private utilityManager: UtilityManager
    ) {
        this.requestLimiter = {
            serverRequests: new Map<string, number>(),
            lastAttemptTimes: new Map<string, number>(),
            pendingRequests: new Map<string, Promise<any>>(),
            MIN_REQUEST_INTERVAL: 60000,
            MAX_REQUESTS_PER_SERVER: 3,
        };
    }

    private isServerBlocked(serverId: string): boolean {
        const count = this.requestLimiter.serverRequests.get(serverId) || 0;
        const lastAttempt = this.requestLimiter.lastAttemptTimes.get(serverId) || 0;
        const now = Date.now();

        return count >= this.requestLimiter.MAX_REQUESTS_PER_SERVER ||
            (now - lastAttempt < this.requestLimiter.MIN_REQUEST_INTERVAL);
    }

    private recordAttempt(serverId: string) {
        const count = this.requestLimiter.serverRequests.get(serverId) || 0;
        this.requestLimiter.serverRequests.set(serverId, count + 1);
        this.requestLimiter.lastAttemptTimes.set(serverId, Date.now());
        this.logger.info(`Recorded attempt ${count + 1}/${this.requestLimiter.MAX_REQUESTS_PER_SERVER} for server ${serverId}`);
    }

    private getOrCreateRequest(serverId: string, createFn: () => Promise<any>) {
        if (this.requestLimiter.pendingRequests.has(serverId)) {
            return this.requestLimiter.pendingRequests.get(serverId)!;
        }

        const promise = createFn();
        this.requestLimiter.pendingRequests.set(serverId, promise);

        promise.finally(() => {
            this.requestLimiter.pendingRequests.delete(serverId);
        });

        return promise;
    }

    async getMembers(serverId: string) {
        this.logger.info(`Fetching members for server: ${serverId}`);

        if (this.isServerBlocked(serverId)) {
            this.logger.info(`Server ${serverId} is blocked from further requests due to rate limiting`);
            throw new Error("Rate limit exceeded for member requests to this server");
        }

        return this.getOrCreateRequest(serverId, async () => {
            this.recordAttempt(serverId);

            try {
                const cachedMembers = useGlobalState.getState().getServerMembers(serverId);
                if (cachedMembers && cachedMembers.length > 0) {
                    this.logger.info(`Using cached members for ${serverId}`);
                    return { success: true, members: cachedMembers };
                }

                const res = await aofetch(`${serverId}/get-members`, {
                    CU_URL: this.connectionManager.getCurrentEndpoint(),
                });

                this.logger.info(`Response:`, res);

                if (res.status == 200) {
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
                        this.logger.warn('Error caching members:', error);
                    }

                    return res.json;
                } else {
                    throw new Error(res.error || "Failed to get members");
                }
            } catch (error) {
                this.logger.error(`Error fetching members for ${serverId}:`, error);
                throw error;
            }
        });
    }

    async getSingleMember(serverId: string, memberId: string): Promise<Member | null> {
        try {
            this.logger.info(`Getting member ${memberId} from server: ${serverId}`);
            const res = await aofetch(`${serverId}/single-member`, {
                method: "GET",
                body: { id: memberId },
                CU_URL: this.connectionManager.getCurrentEndpoint()
            });

            this.logger.info(`Response:`, res);

            if (res.status == 200) {
                const response = res.json as SingleMemberResponse;
                return response.member;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            this.logger.error(`Error getting member data:`, error);
            return null;
        }
    }

    async updateNickname(serverId: string, nickname: string) {
        this.logger.info(`Updating nickname in server: ${serverId}`, { nickname });

        try {
            const safeNickname = nickname || "";

            const res = await aofetch(`${serverId}/update-nickname`, {
                method: "POST",
                body: { nickname: safeNickname },
                CU_URL: this.connectionManager.getCurrentEndpoint(),
                signer: this.connectionManager.getAOSigner()
            });

            this.logger.info(`Response:`, res);

            if (res.status == 200) {
                try {
                    const { address } = useWallet();
                    const globalState = useGlobalState.getState();
                    globalState.updateMemberNickname(serverId, address, safeNickname);
                } catch (error) {
                    this.logger.warn('Failed to update local cache:', error);
                }

                try {
                    await this.utilityManager.refreshCurrentServerData();
                } catch (error) {
                    this.logger.warn('Failed to refresh data:', error);
                }
                return res.json;
            } else {
                this.logger.error(`Server error:`, res.error || res.status);
                toast.error("Server does not support nickname updates");
                return { success: false, error: res.error || "Server error" };
            }
        } catch (error) {
            this.logger.error('Error updating nickname:', error);
            toast.error("Server does not support nickname updates yet");
            return { success: false, error: "Endpoint not available" };
        }
    }
}

// Profile Manager
export class ProfileManager {
    private logger = createLogger('ProfileManager');

    constructor(private connectionManager: ConnectionManager) { }

    async getProfile(address?: string) {
        this.logger.info(`Fetching profile for:`, address || "current user");
        const res = await aofetch(`${AOConstants.PROFILES}/profile`, {
            method: "GET",
            body: address ? { id: address } : undefined,
            CU_URL: this.connectionManager.getCurrentEndpoint()
        });

        this.logger.info(`Response:`, res);

        if (res.status == 200) {
            const profileData = res.json as Record<string, any>;

            if (profileData.profile?.original_id || address) {
                const originalAddress = profileData.profile?.original_id ?? address;
                try {
                    this.logger.info(`Fetching primary name for ${originalAddress}`);
                    const ario = this.connectionManager.getARIOClient();
                    const primaryNameData = await ario.getPrimaryName({ address: originalAddress });

                    if (primaryNameData && primaryNameData.name) {
                        this.logger.info(`Found primary name: ${primaryNameData.name}`);

                        if (!profileData.profile) {
                            profileData.profile = {};
                        }

                        profileData.primaryName = primaryNameData.name;

                        try {
                            const globalState = useGlobalState.getState();
                            globalState.updateUserProfileCache(originalAddress, {
                                username: profileData.profile?.username,
                                pfp: profileData.profile?.pfp,
                                primaryName: primaryNameData.name,
                                timestamp: Date.now()
                            });
                            this.logger.info(`Updated user profiles cache with primary name directly`);
                        } catch (syncError) {
                            this.logger.warn(`Failed to sync primary name to cache:`, syncError);
                        }
                    }
                } catch (error) {
                    this.logger.warn(`Failed to fetch primary name:`, error);
                }
            }

            return profileData;
        } else {
            throw new Error(res.error);
        }
    }

    async getBulkProfiles(addresses: string[]) {
        if (!addresses || addresses.length === 0) {
            this.logger.warn(`No addresses provided`);
            return { profiles: [] };
        }

        const uniqueAddresses = [...new Set(addresses)];
        this.logger.info(`Fetching profiles for ${uniqueAddresses.length} users`);

        const res = await aofetch(`${AOConstants.PROFILES}/bulk-profile`, {
            method: "GET",
            body: { ids: JSON.stringify(uniqueAddresses) },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
        });

        this.logger.info(`Response status:`, res.status);

        if (res.status == 200) {
            const profilesData = res.json as { success: boolean, profiles: any[] };

            if (profilesData.profiles && profilesData.profiles.length > 0) {
                try {
                    const globalState = useGlobalState.getState();
                    const now = Date.now();
                    const ario = this.connectionManager.getARIOClient();

                    profilesData.profiles.forEach(profile => {
                        if (!profile.id) return;

                        globalState.updateUserProfileCache(profile.id, {
                            username: profile.username,
                            pfp: profile.pfp,
                            timestamp: now
                        });
                    });

                    profilesData.profiles.forEach(async (profile) => {
                        if (!profile.id) return;

                        try {
                            const existingProfile = globalState.getUserProfileFromCache(profile.id);

                            if (!existingProfile?.primaryName) {
                                const primaryNameData = await ario.getPrimaryName({ address: profile.id });
                                const primaryName = primaryNameData?.name;

                                if (primaryName) {
                                    const updatedProfile = {
                                        ...existingProfile,
                                        primaryName,
                                        timestamp: Date.now()
                                    };
                                    globalState.updateUserProfileCache(profile.id, updatedProfile);
                                    profile.primaryName = primaryName;
                                }
                            } else {
                                profile.primaryName = existingProfile.primaryName;
                            }
                        } catch (error) {
                            this.logger.warn(`Failed to fetch primary name for ${profile.id}:`, error);
                        }
                    });

                    this.logger.info(`Successfully cached ${profilesData.profiles.length} profiles`);
                } catch (error) {
                    this.logger.warn(`Error caching profiles:`, error);
                }
            }

            return profilesData;
        } else {
            this.logger.error(`Error fetching profiles:`, res.error);
            throw new Error(res.error);
        }
    }

    async updateProfile(username?: string, pfp?: string) {
        this.logger.info(`Updating profile:`, { username, pfp });
        const res = await aofetch(`${AOConstants.PROFILES}/update-profile`, {
            method: "POST",
            body: { username, pfp },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        })

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }
}

// Server Join Manager
export class ServerJoinManager {
    private logger = createLogger('ServerJoinManager');

    constructor(
        private connectionManager: ConnectionManager,
        private utilityManager: UtilityManager
    ) { }

    async getJoinedServers(address: string): Promise<string[]> {
        this.logger.info(`Fetching joined servers for address: ${address}`);
        const res = await aofetch(`${AOConstants.PROFILES}/profile`, {
            method: "GET",
            body: { id: address },
            CU_URL: this.connectionManager.getCurrentEndpoint()
        });

        this.logger.info(`Response:`, res);

        if (res.status == 200) {
            try {
                const globalState = useGlobalState.getState();
                const responseData = res.json as { profile: { servers_joined: string, [key: string]: any } };
                if (responseData && responseData.profile) {
                    this.logger.info(`Caching user profile data for ${address}`);
                    globalState.setUserProfile(responseData);
                }
            } catch (error) {
                this.logger.warn(`Failed to cache profile data:`, error);
            }

            const responseData = res.json as { profile: { servers_joined: string } };
            const joinedServersString = responseData.profile.servers_joined === "{}" ? "[]" : responseData.profile.servers_joined;
            const servers = JSON.parse(joinedServersString);
            this.logger.info(`Parsed servers:`, servers);
            return servers;
        } else {
            throw new Error(res.error);
        }
    }

    async joinServer(serverId: string) {
        this.logger.info(`Joining server: ${serverId}`);
        const res = await aofetch(`${AOConstants.PROFILES}/join-server`, {
            method: "POST",
            body: { server_id: serverId },
            CU_URL: this.connectionManager.getCurrentEndpoint(),
            signer: this.connectionManager.getAOSigner()
        });

        this.logger.info(`Response:`, res);
        if (res.status == 200) {
            try {
                await this.utilityManager.refreshCurrentServerData();
            } catch (error) {
                this.logger.warn('Failed to refresh data:', error);
            }
            return res.json;
        } else {
            throw new Error(res.error);
        }
    }

    async leaveServer(serverId: string): Promise<boolean> {
        try {
            this.logger.info(`Leaving server: ${serverId}`);
            const res = await aofetch(`${AOConstants.PROFILES}/leave-server`, {
                method: "POST",
                body: { server_id: serverId },
                CU_URL: this.connectionManager.getCurrentEndpoint(),
                signer: this.connectionManager.getAOSigner()
            });

            this.logger.info(`Response:`, res);

            if (res.status == 200) {
                try {
                    await this.utilityManager.refreshCurrentServerData();
                } catch (error) {
                    this.logger.warn('Failed to refresh data:', error);
                }
                return true;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            this.logger.error("Error leaving server:", error);
            throw error;
        }
    }
}

// Delegation Manager
export class DelegationManager {
    private logger = createLogger('DelegationManager');

    constructor(private connectionManager: ConnectionManager) { }

    async delegate(delegatedId: string): Promise<boolean> {
        try {
            this.logger.info(`Delegating address: ${delegatedId}`);
            const res = await aofetch(`${AOConstants.PROFILES}/delegate`, {
                method: "POST",
                body: { delegated_id: delegatedId },
                CU_URL: this.connectionManager.getCurrentEndpoint(),
                signer: this.connectionManager.getAOSigner()
            });

            this.logger.info(`Response:`, res);

            if (res.status == 200) {
                return true;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            this.logger.error("Error delegating address:", error);
            throw error;
        }
    }

    async undelegate(delegatedId: string): Promise<boolean> {
        try {
            this.logger.info(`Removing delegation for address: ${delegatedId}`);
            const res = await aofetch(`${AOConstants.PROFILES}/undelegate`, {
                method: "POST",
                body: { delegated_id: delegatedId },
                CU_URL: this.connectionManager.getCurrentEndpoint(),
                signer: this.connectionManager.getAOSigner()
            });

            this.logger.info(`Response:`, res);

            if (res.status == 200) {
                return true;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            this.logger.error("Error removing delegation:", error);
            throw error;
        }
    }

    async checkDelegation(address?: string) {
        try {
            this.logger.info(`Checking delegation status for:`, address || "current user");
            const res = await aofetch(`${AOConstants.PROFILES}/check-delegation`, {
                method: "GET",
                body: address ? { id: address } : undefined,
                CU_URL: this.connectionManager.getCurrentEndpoint()
            });

            this.logger.info(`Response:`, res);

            if (res.status == 200) {
                return res.json;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            this.logger.error("Error checking delegation:", error);
            throw error;
        }
    }
}

// Notification Manager
export class NotificationManager {
    private logger = createLogger('NotificationManager');
    private cache = {
        data: new Map<string, NotificationCacheData>(),
        pendingRequests: new Map<string, Promise<any>>(),
        lastRequestTime: new Map<string, number>(),
        MIN_REQUEST_INTERVAL: 4000,
        CACHE_TTL: 10000,
    };

    constructor(private connectionManager: ConnectionManager) { }

    private shouldThrottle(address: string): boolean {
        const lastRequest = this.cache.lastRequestTime.get(address) || 0;
        return (Date.now() - lastRequest) < this.cache.MIN_REQUEST_INTERVAL;
    }

    private getCachedData(address: string): any | null {
        const cached = this.cache.data.get(address);
        if (cached && (Date.now() - cached.timestamp) < this.cache.CACHE_TTL) {
            this.logger.info(`Using cached notifications for ${address}, age: ${Date.now() - cached.timestamp}ms`);
            return cached.notifications;
        }
        return null;
    }

    private setCachedData(address: string, data: any): void {
        this.cache.data.set(address, {
            notifications: data,
            timestamp: Date.now()
        });
        this.logger.info(`Updated cache for ${address}`);
    }

    private recordRequest(address: string): void {
        this.cache.lastRequestTime.set(address, Date.now());
    }

    private getOrCreateRequest(address: string, createFn: () => Promise<any>): Promise<any> {
        if (this.cache.pendingRequests.has(address)) {
            this.logger.info(`Reusing pending request for ${address}`);
            return this.cache.pendingRequests.get(address)!;
        }

        const promise = createFn().finally(() => {
            this.cache.pendingRequests.delete(address);
        });

        this.cache.pendingRequests.set(address, promise);
        return promise;
    }

    async getNotifications(address: string) {
        this.logger.info(`Fetching notifications for address: ${address}`);

        const cachedData = this.getCachedData(address);
        if (cachedData) {
            return cachedData;
        }

        if (this.shouldThrottle(address)) {
            this.logger.info(`Throttling request for ${address}, using cache or empty result`);
            return cachedData || { messages: [], isEmpty: true };
        }

        this.recordRequest(address);

        return this.getOrCreateRequest(address, async () => {
            try {
                const res = await aofetch(`${AOConstants.PROFILES}/get-notifications`, {
                    method: "GET",
                    body: { id: address },
                    CU_URL: this.connectionManager.getCurrentEndpoint(),
                });

                this.logger.info(`Response status:`, res.status);

                if (res.status == 200) {
                    const responseData = res.json as { notifications: any[] };

                    if (!responseData.notifications || responseData.notifications.length === 0) {
                        this.logger.info('No new notifications');
                        const result = { messages: [], isEmpty: true };
                        this.setCachedData(address, result);
                        return result;
                    }

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

                    this.logger.info(`Found ${messages.length} notifications`);

                    const result = { messages: messages, isEmpty: messages.length === 0 };
                    this.setCachedData(address, result);
                    return result;
                } else {
                    throw new Error(res.error);
                }
            } catch (error) {
                this.logger.error("Error fetching notifications:", error);
                throw error;
            }
        });
    }

    async markNotificationsAsRead(serverId: string, channelId: number) {
        this.logger.info(`Marking notifications as read for server: ${serverId}, channel: ${channelId}`);

        try {
            const res = await aofetch(`${AOConstants.PROFILES}/mark-read`, {
                method: "POST",
                body: { server_id: serverId, channel_id: channelId },
                CU_URL: this.connectionManager.getCurrentEndpoint(),
                signer: this.connectionManager.getAOSigner()
            });

            this.logger.info(`Response:`, res);

            if (res.status == 200) {
                return res.json;
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            this.logger.error("Error marking notifications as read:", error);
            throw error;
        }
    }
}

// Main AO Manager - Facade class that provides easy access to all managers
export class AOManager {
    public readonly connection: ConnectionManager;
    public readonly utility: UtilityManager;
    public readonly file: FileManager;
    public readonly server: ServerManager;
    public readonly category: CategoryManager;
    public readonly channel: ChannelManager;
    public readonly message: MessageManager;
    public readonly member: MemberManager;
    public readonly profile: ProfileManager;
    public readonly serverJoin: ServerJoinManager;
    public readonly delegation: DelegationManager;
    public readonly notification: NotificationManager;

    constructor() {
        this.connection = new ConnectionManager();
        this.utility = new UtilityManager(this.connection);
        this.file = new FileManager(this.connection, this.utility);
        this.server = new ServerManager(this.connection, this.utility, this.file);
        this.category = new CategoryManager(this.connection, this.utility);
        this.channel = new ChannelManager(this.connection, this.utility);
        this.message = new MessageManager(this.connection);
        this.member = new MemberManager(this.connection, this.utility);
        this.profile = new ProfileManager(this.connection);
        this.serverJoin = new ServerJoinManager(this.connection, this.utility);
        this.delegation = new DelegationManager(this.connection);
        this.notification = new NotificationManager(this.connection);
    }

    // Convenience methods for commonly used operations
    async createServerWithJoin(name: string, icon: File): Promise<string> {
        return await this.server.createServer(name, icon);
    }

    async refreshData(): Promise<void> {
        return await this.utility.refreshCurrentServerData();
    }
}

// Export a singleton instance for global use
export const aoManager = new AOManager(); 