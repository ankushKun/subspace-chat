import { aofetch } from "ao-fetch"
import { connect, createDataItemSigner } from "@permaweb/aoconnect"
import type { MessageResult } from "node_modules/@permaweb/aoconnect/dist/lib/result";
import type { Tag } from "@/lib/types"
import aoxpressSource from "@/lib/lua/aoxpress"
import serverSource from "@/lib/lua/server"
// import { TurboFactory } from "@ardrive/turbo-sdk/web";
import Arweave from "arweave";

const SCHEDULER = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA"
const MODULE = "33d-3X8mpv6xYBlVB-eXMrPfH5Kzf6Hiwhcv0UA10sw"

export const PROFILES = "_N6UYJmLpVBYWlNWlOTG7saz7Ot3XCse3IyyWbXOJxk"

const CommonTags: Tag[] = [
    { name: "App-Name", value: "BetterIDEa" },
    // @ts-ignore
    { name: "App-Version", value: window.APP_VERSION },
    { name: 'Authority', value: 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY' },
];


const ao = connect({
    MODE: "legacy",
    CU_URL: `https://cu.ardrive.io`,
})

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
    console.log("Spawning server...");

    // Read the file as an ArrayBuffer properly
    const iconUint8Array = await to(icon);

    console.log("Icon array buffer created", iconUint8Array.byteLength, icon.type);

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

    console.log("Got server id", serverId);

    console.log("Loading aoxpress...");
    const aoxpressRes = await runLua(aoxpressSource, serverId)
    console.log(await parseOutput(aoxpressRes));
    console.log("aoxpress loaded");

    console.log("Initializing server...");
    const initServerRes = await runLua(serverSource, serverId)
    console.log(await parseOutput(initServerRes));
    console.log("Server initialized");

    console.log("Updating server details...");
    const updateServerRes = await aofetch(`${serverId}/update-server`, {
        method: "POST",
        body: {
            name: name,
            icon: serverId
        }
    })
    console.log(updateServerRes);

    if (updateServerRes.status == 200) {
        console.log("Server details updated");
    } else {
        throw new Error(updateServerRes.error);
    }

    console.log("Joining server...");
    const joinServerRes = await aofetch(`${PROFILES}/join-server`, {
        method: "POST",
        body: {
            server_id: serverId
        }
    })
    console.log(joinServerRes);
    if (joinServerRes.status == 200) {
        console.log("Server joined");
    } else {
        throw new Error(joinServerRes.error);
    }

    return serverId;
}

export async function runLua(code: string, process: string, tags?: Tag[]) {
    console.log("Running lua", code);

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
    // without turbo
    const ar = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
    });

    const tx = await ar.createTransaction({ data: await to(file) }, "use_wallet");

    tx.addTag("Content-Type", file.type);
    tx.addTag("App-Name", "Subspace-Chat");
    // @ts-ignore
    tx.addTag("App-Version", window.APP_VERSION);

    await ar.transactions.sign(tx, "use_wallet");
    const res = await ar.transactions.post(tx);

    if (res.status == 200) {
        return tx.id;
    } else {
        throw new Error(res.statusText);
    }
}

// export async function uploadFileAndGetId(file: File): Promise<string> {
//     try {
//         // Create an unauthenticated client (for browser environments)
//         // In real implementation, you'd use an authenticated client with your wallet
//         const turbo = TurboFactory.authenticated({ token: 'arweave' });

//         // Create a stream factory from the File object
//         const fileStreamFactory = () => file.stream();

//         // Create a size factory that returns the file size
//         const fileSizeFactory = () => file.size;

//         // Determine the Content-Type based on the file's type
//         const contentType = file.type || 'application/octet-stream';

//         // Upload the file with proper Content-Type tag
//         const response = await turbo.uploadFile({
//             // @ts-ignore
//             fileStreamFactory,
//             fileSizeFactory,
//             dataItemOpts: {
//                 tags: [
//                     { name: "Content-Type", value: contentType }
//                 ]
//             }
//         });

//         console.log("File uploaded successfully:", response);

//         // Return the transaction ID
//         return response.id;
//     } catch (error) {
//         console.error("Error uploading file:", error);
//         throw error;
//     }
// }

export async function getJoinedServers(address: string): Promise<string[]> {
    const res = await aofetch(`${PROFILES}/profile`, {
        method: "GET",
        body: {
            id: address
        },
    })

    if (res.status == 200) {
        return JSON.parse((res.json as any).profile.servers_joined || "[]");
    } else {
        throw new Error(res.error);
    }
}

export async function getServerInfo(id: string) {
    const res = await aofetch(`${id}/`)
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function updateServer(id: string, name: string, icon: string) {
    const res = await aofetch(`${id}/update-server`, {
        method: "POST",
        body: {
            name,
            icon
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function createCategory(serverId: string, name: string, order?: number) {
    const res = await aofetch(`${serverId}/create-category`, {
        method: "POST",
        body: {
            name,
            order
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function updateCategory(serverId: string, id: number, name: string, order?: number) {
    const res = await aofetch(`${serverId}/update-category`, {
        method: "POST",
        body: {
            id,
            name,
            order
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function deleteCategory(serverId: string, id: number) {
    const res = await aofetch(`${serverId}/delete-category`, {
        method: "POST",
        body: {
            id
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function createChannel(serverId: string, name: string, categoryId?: number, order?: number) {
    const res = await aofetch(`${serverId}/create-channel`, {
        method: "POST",
        body: {
            name,
            category_id: categoryId,
            order
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function updateChannel(serverId: string, id: number, name?: string, categoryId?: number, order?: number) {
    const res = await aofetch(`${serverId}/update-channel`, {
        method: "POST",
        body: {
            id,
            name,
            category_id: categoryId,
            order
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function deleteChannel(serverId: string, id: number) {
    const res = await aofetch(`${serverId}/delete-channel`, {
        method: "POST",
        body: {
            id
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function getMessages(serverId: string, channelId: number) {
    const res = await aofetch(`${serverId}/get-messages`, {
        method: "GET",
        body: {
            channel_id: channelId
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function sendMessage(serverId: string, channelId: number, content: string) {
    const res = await aofetch(`${serverId}/send-message`, {
        method: "POST",
        body: {
            channel_id: channelId,
            content
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function editMessage(serverId: string, msgId: string, content: string) {
    const res = await aofetch(`${serverId}/edit-message`, {
        method: "POST",
        body: {
            msg_id: msgId,
            content
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function deleteMessage(serverId: string, msgId: string) {
    const res = await aofetch(`${serverId}/delete-message`, {
        method: "POST",
        body: {
            msg_id: msgId
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function getProfile(address?: string) {
    const res = await aofetch(`${PROFILES}/profile`, {
        method: "GET",
        body: address ? { id: address } : undefined
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function updateProfile(username?: string, pfp?: string) {
    const res = await aofetch(`${PROFILES}/update-profile`, {
        method: "POST",
        body: {
            username,
            pfp
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function joinServer(serverId: string) {
    const res = await aofetch(`${PROFILES}/join-server`, {
        method: "POST",
        body: {
            server_id: serverId
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

export async function leaveServer(serverId: string) {
    const res = await aofetch(`${PROFILES}/leave-server`, {
        method: "POST",
        body: {
            server_id: serverId
        }
    });
    if (res.status == 200) {
        return res.json;
    } else {
        throw new Error(res.error);
    }
}

