import { connect, createDataItemSigner } from "@permaweb/aoconnect"
import { Constants } from "../constants";
import { ArweaveSigner, createData, DataItem } from "@dha-team/arbundles"
import { ARIO } from "@ar.io/sdk"

import type { JWKInterface } from "arweave/web/lib/wallet";
import type { Tag } from "@/types/ao";
import type { SendMessageArgs } from "node_modules/@permaweb/aoconnect/dist/lib/message";
import type { MessageResult } from "node_modules/@permaweb/aoconnect/dist/lib/result";
import type { SpawnProcessArgs } from "node_modules/@permaweb/aoconnect/dist/lib/spawn";

import { User } from "./user";
import { ServerManager } from "./server";
import { Logger } from "@/lib/utils";

export class Subspace {
    connectionManager: ConnectionManager;
    user: User;
    server: ServerManager;


    constructor() {
        this.connectionManager = new ConnectionManager();
        this.user = new User(this.connectionManager);
        this.server = new ServerManager(this.connectionManager);
    }
}

export class ConnectionManager {
    private cuIndex: number = 0
    ao: any
    ario = ARIO.mainnet()

    constructor() {
        this.cuIndex = 0;
        this.ao = connect({ MODE: "legacy", CU_URL: Constants.CuEndpoints[this.cuIndex] })
    }

    switchCu() {
        this.cuIndex = (this.cuIndex + 1) % Constants.CuEndpoints.length;
        this.ao = connect({ MODE: "legacy", CU_URL: Constants.CuEndpoints[this.cuIndex] })
        return this.ao
    }

    getCuUrl() { Constants.CuEndpoints[this.cuIndex] }
    getAo() { this.ao }

    getAoSigner(jwk?: JWKInterface) {
        if (jwk) {
            const newSigner = async (create: any, createDataItem = (buf: any) => new DataItem(buf)) => {
                const { data, tags, target, anchor } = await create({ alg: 'rsa-v1_5-sha256', passthrough: true });

                const arweaveSigner = new ArweaveSigner(jwk);
                const dataItem = createData(data, arweaveSigner, { tags, target, anchor });
                await dataItem.sign(arweaveSigner);

                return {
                    id: dataItem.id,
                    raw: dataItem.getRaw()
                };
            };
            return newSigner;
        }
        return createDataItemSigner(window.arweaveWallet);
    }

    async spawn({ tags }: { tags: Tag[] }): Promise<string> {
        const args: SpawnProcessArgs = {
            scheduler: Constants.Scheduler,
            module: Constants.Module,
            signer: this.getAoSigner(),
            tags
        }
        const res: string = await this.ao.spawn(args)

        return res;
    }

    async execLua({ processId, code, tags }: { processId: string, code: string, tags: Tag[] }): Promise<MessageResult> {
        const args: SendMessageArgs = {
            process: processId,
            data: code,
            signer: this.getAoSigner(),
            tags,
        }
        const messageId: string = await this.ao.message(args)
        const res: MessageResult = await this.ao.result({
            process: processId,
            message: messageId,
        })
        return res;
    }

    parseOutput(res: MessageResult, { hasMatchingTag }: { hasMatchingTag?: string } = {}) {
        if (res.Error) {
            console.error(res.Error)
            Logger.error("parseOutput", {})
        }

        if (res.Output && res.Output.data) {
            try {
                return JSON.parse(res.Output.data)
            } catch {
                return res.Output.data
            }
        }

        let returnMessage = null;
        if (res.Messages && res.Messages.length > 0) {
            if (hasMatchingTag) {
                for (const message of res.Messages) {
                    if (message.Tags && message.Tags.find((tag: Tag) => tag.name == hasMatchingTag)) {
                        returnMessage = message;
                        break;
                    }
                }
            } else {
                if (res.Messages.length == 1) {
                    returnMessage = res.Messages[0];
                } else {
                    returnMessage = res.Messages;
                }
            }
        }

        return returnMessage;
    }
}



