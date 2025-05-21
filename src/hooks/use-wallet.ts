import { create } from "zustand";
import "arweave"
import { WanderConnect } from "@wanderapp/connect";

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
    setWanderInstance: (instance: WanderConnect | null) => void
    connect: (strategy: ConnectionStrategies) => Promise<State>;
    disconnect: () => Promise<void>;
}

export const useWallet = create<State>((set, get) => ({
    address: null,
    shortAddress: null,
    connected: false,
    connectionStrategy: null,
    wanderInstance: null,
    setWanderInstance: (instance: WanderConnect | null) => set({ wanderInstance: instance }),
    connect: async (strategy: ConnectionStrategies) => {
        switch (strategy) {
            case ConnectionStrategies.JWK: {
                const state = get();
                if (state.wanderInstance) {
                    state.wanderInstance.destroy();
                    set({ wanderInstance: null, connectionStrategy: null });
                }
                // todo
                console.log("TODO")
                window.localStorage.setItem("subspace-conn-strategy", ConnectionStrategies.JWK);
                break;
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
                window.localStorage.setItem("subspace-conn-strategy", ConnectionStrategies.ArWallet);
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
                window.localStorage.setItem("subspace-conn-strategy", ConnectionStrategies.WanderConnect);
                break;
            }
        }

    },
    disconnect: async () => {
        const state = get();
        if (state.wanderInstance) {
            state.wanderInstance.destroy();
        }
        set({ wanderInstance: null, connectionStrategy: null });
        switch (state.connectionStrategy) {
            case ConnectionStrategies.JWK: {
                // todo
                console.log("TODO")
                break;
            }
            case ConnectionStrategies.ArWallet: {
                await window.arweaveWallet.disconnect();
                set({ address: null, shortAddress: null, connected: false, connectionStrategy: null });
                window.removeEventListener("walletSwitch", (e) => { });
                break;
            }
            case ConnectionStrategies.WanderConnect: {
                // todo

                break;
            }
        }
        window.localStorage.setItem("subspace-conn-strategy", "");
        window.location.reload();
    }
}));