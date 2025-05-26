import { create } from "zustand";
import "arweave"
import { WanderConnect } from "@wanderapp/connect";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/web/lib/wallet";

export enum ConnectionStrategies {
    ArWallet = "ar_wallet",
    WanderConnect = "wander_connect",
    JWK = "jwk"
}

interface State {
    address: string | null;
    shortAddress: string | null;
    connected: boolean;
    connectionStrategy: ConnectionStrategies | null;
    wanderInstance: WanderConnect | null
    jwk?: JWKInterface
    setWanderInstance: (instance: WanderConnect | null) => void
    updateAddress: (address: string) => void
    connect: (strategy: ConnectionStrategies) => Promise<State>;
    disconnect: () => Promise<void>;
}

export const useWallet = create<State>((set, get) => ({
    address: null,
    shortAddress: null,
    connected: false,
    connectionStrategy: null,
    wanderInstance: null,
    jwk: undefined,
    setWanderInstance: (instance: WanderConnect | null) => set({ wanderInstance: instance }),
    updateAddress: (address: string) => set({
        address,
        shortAddress: address ? address.slice(0, 5) + "..." + address.slice(-5) : null
    }),
    connect: async (strategy: ConnectionStrategies) => {
        switch (strategy) {
            case ConnectionStrategies.JWK: {
                const state = get();
                if (state.wanderInstance) {
                    state.wanderInstance.destroy();
                    set({ wanderInstance: null, connectionStrategy: null });
                }
                const jwk = JSON.parse(window.localStorage.getItem("subspace-jwk") || "{}");
                const requiredKeys = ["kty", "e", "n", "d", "p", "q", "dp", "dq", "qi"];
                const allKeysPresent = requiredKeys.every(key => jwk[key]);
                if (!allKeysPresent) {
                    throw new Error("Missing required keys");
                }
                const ar = new Arweave({});
                const addr = await ar.wallets.getAddress(jwk);
                if (addr) {
                    console.log("connecting to", addr);
                    const d = {
                        address: addr,
                        shortAddress: addr.slice(0, 5) + "..." + addr.slice(-5),
                        connected: true,
                        connectionStrategy: ConnectionStrategies.JWK,
                        jwk: jwk
                    }
                    set(d)
                    window.localStorage.setItem("subspace-conn-strategy", JSON.stringify(ConnectionStrategies.JWK));
                    return d as State;
                }
                else {
                    throw new Error("Failed to get address");
                }
            };
            case ConnectionStrategies.ArWallet: {
                const state = get();
                if (state.wanderInstance) {
                    state.wanderInstance.destroy();
                    set({ wanderInstance: null, connectionStrategy: null });
                }
                await window.arweaveWallet.connect(["SIGN_TRANSACTION", "ACCESS_ADDRESS", "ACCESS_PUBLIC_KEY"]);
                const address = await window.arweaveWallet.getActiveAddress();
                const shortAddress = address.slice(0, 5) + "..." + address.slice(-5);
                window.addEventListener("walletSwitch", (e) => {
                    const addr = e.detail.address;
                    const shortAddr = addr.slice(0, 5) + "..." + addr.slice(-5);
                    set({
                        address: addr,
                        shortAddress: shortAddr,
                        connected: true,
                        connectionStrategy: ConnectionStrategies.ArWallet
                    });
                })
                set({
                    address,
                    shortAddress: shortAddress,
                    connected: true,
                    connectionStrategy: ConnectionStrategies.ArWallet
                });
                window.localStorage.setItem("subspace-conn-strategy", JSON.stringify(ConnectionStrategies.ArWallet));
                return { address, shortAddress, connected: true, connectionStrategy: ConnectionStrategies.ArWallet } as State;
            };
            case ConnectionStrategies.WanderConnect: {
                // todo
                const state = get();
                if (state.wanderInstance) {
                    state.wanderInstance.open()
                }
                else {
                    const wander = new WanderConnect({
                        clientId: "FREE_TRIAL",
                        button: {
                            position: "static",
                            theme: "dark"
                        },

                        onAuth: async (userDetails) => {
                            console.log(userDetails)
                            if (!!userDetails) {
                                try {
                                    await window.arweaveWallet.connect(["ACCESS_ADDRESS", "SIGN_TRANSACTION", "ACCESS_PUBLIC_KEY"]);
                                    const addy = await window.arweaveWallet.getActiveAddress();
                                    const shortAddr = addy.slice(0, 5) + "..." + addy.slice(-5);
                                    const d = {
                                        address: addy,
                                        shortAddress: shortAddr,
                                        connected: true,
                                        connectionStrategy: ConnectionStrategies.WanderConnect
                                    }
                                    set(d);
                                    window.localStorage.setItem("subspace-conn-strategy", JSON.stringify(ConnectionStrategies.WanderConnect));
                                    return Promise.resolve(d);
                                } catch (e) {
                                    console.error("Error", e);
                                }
                            }
                        }
                    })
                    set({ wanderInstance: wander, connectionStrategy: ConnectionStrategies.WanderConnect });
                    wander.open();
                }
                break;
            }
        }

    },
    disconnect: async () => {
        const state = get();
        switch (state.connectionStrategy) {
            case ConnectionStrategies.JWK: {
                window.localStorage.removeItem("subspace-jwk");
                break;
            }
            case ConnectionStrategies.ArWallet: {
                await window.arweaveWallet.disconnect();
                set({ address: null, shortAddress: null, connected: false, connectionStrategy: null });
                window.removeEventListener("walletSwitch", (e) => { });
                break;
            }
            case ConnectionStrategies.WanderConnect: {
                if (state.wanderInstance) {
                    state.wanderInstance.destroy();
                }
                set({ wanderInstance: null, connectionStrategy: null });
                break;
            }
        }
        window.localStorage.setItem("subspace-conn-strategy", JSON.stringify(null));
        window.location.reload();
    }
}));