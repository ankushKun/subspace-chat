import { create } from "zustand";
import "arweave"
import { WanderConnect } from "@wanderapp/connect";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/web/lib/wallet";
import { createJSONStorage, persist } from "zustand/middleware";

export enum ConnectionStrategies {
    ArWallet = "ar_wallet",
    WanderConnect = "wander_connect",
    ScannedJWK = "scanned_jwk",
    // UploadedJWK = "uploaded_jwk" // TODO: add later
}

interface WalletState {
    address: string;
    connected: boolean;
    connectionStrategy: ConnectionStrategies | null;
    wanderInstance: WanderConnect | null // only exists if connectionStrategy is WanderConnect
    jwk?: JWKInterface // only exists if connectionStrategy is ScannedJWK
    actions: WalletActions
}

interface WalletActions {
    setWanderInstance: (instance: WanderConnect | null) => void
    updateAddress: (address: string) => void
    connect: (strategy: ConnectionStrategies, jwk?: JWKInterface) => Promise<void>
    disconnect: () => void
}



export const useWallet = create<WalletState>()(persist((set, get) => ({
    // state
    address: "",
    connected: false,
    connectionStrategy: null,
    wanderInstance: null,
    jwk: undefined,

    actions: {
        setWanderInstance: (instance: WanderConnect | null) => set({ wanderInstance: instance }),
        updateAddress: (address: string) => set({ address }),

        connect: async (strategy: ConnectionStrategies, jwk?: JWKInterface) => {

            // const state = get();
            // state.actions.disconnect();

            switch (strategy) {
                case ConnectionStrategies.ScannedJWK: {
                    if (!jwk) throw new Error("Connection Strategy: ScannedJWK requires a JWK to be passed to the connect function")
                    const requiredKeys = ["kty", "e", "n", "d", "p", "q", "dp", "dq", "qi"];
                    const allKeysPresent = requiredKeys.every(key => jwk[key]);
                    if (!allKeysPresent) throw new Error("Missing required values in JWK");

                    const ar = new Arweave({});
                    const addr = await ar.wallets.getAddress(jwk);
                    if (!addr) throw new Error("Failed to get address");

                    set((state) => {
                        if (state.connected && state.connectionStrategy !== ConnectionStrategies.ScannedJWK) state.actions.disconnect();
                        return {
                            address: addr,
                            connected: true,
                            connectionStrategy: ConnectionStrategies.ScannedJWK,
                            wanderInstance: null,
                            jwk: jwk
                        }
                    })
                    break;
                }
                case ConnectionStrategies.ArWallet: {
                    if (window.arweaveWallet) {
                        if (window.arweaveWallet.walletName == "Wander Connect") {
                            set((state) => {
                                if (state.wanderInstance) state.wanderInstance.destroy();
                                return { wanderInstance: null }
                            })
                        }
                        window.arweaveWallet.connect(["SIGN_TRANSACTION", "ACCESS_ADDRESS", "ACCESS_PUBLIC_KEY"]).then(() => {
                            window.arweaveWallet.getActiveAddress().then((address) => {
                                set((state) => {
                                    if (state.connected && state.connectionStrategy !== ConnectionStrategies.ArWallet)
                                        state.actions.disconnect()
                                    window.addEventListener("walletSwitch", (e) => {
                                        set((state) => ({ address: e.detail.address }))
                                    })
                                    return {
                                        address: address,
                                        connected: true,
                                        connectionStrategy: ConnectionStrategies.ArWallet,
                                        wanderInstance: null,
                                        jwk: null
                                    }
                                })
                            })
                        })
                    } else {
                        throw new Error("Arweave Web Wallet not found");
                    }
                    break;
                }
                case ConnectionStrategies.WanderConnect: {
                    set((state) => {
                        if (state.connected && state.connectionStrategy !== ConnectionStrategies.WanderConnect)
                            state.actions.disconnect()
                        if (state.wanderInstance) {
                            state.wanderInstance.open()
                            return state
                        }
                        else {
                            const wander = new WanderConnect({
                                clientId: "FREE_TRIAL",
                                button: {
                                    position: "static",
                                    theme: "dark"
                                },
                                onAuth: (auth) => {
                                    if (!!auth) {
                                        console.log(window.arweaveWallet)
                                        window.arweaveWallet.connect(["ACCESS_ADDRESS", "SIGN_TRANSACTION", "ACCESS_PUBLIC_KEY"]).then(() => {
                                            window.arweaveWallet.getActiveAddress().then((address) => {
                                                set((state) => {
                                                    return {
                                                        address: address,
                                                        connected: true,
                                                        connectionStrategy: ConnectionStrategies.WanderConnect,
                                                        wanderInstance: wander,
                                                        jwk: null
                                                    }
                                                })
                                            })
                                        })
                                    }
                                }
                            })

                            wander.open();
                            return {
                                wanderInstance: wander
                            }
                        }
                    })
                    break;
                }
            }



        },

        disconnect: (reload: boolean = false) => {
            set((state) => {
                if (state.wanderInstance) {
                    state.wanderInstance.destroy();
                }
                if (window.arweaveWallet) {
                    window.arweaveWallet.disconnect().then(() => {
                        window.removeEventListener("walletSwitch", (e) => { });
                    })
                }
                return {
                    address: "",
                    connected: false,
                    connectionStrategy: null,
                    wanderInstance: null,
                    jwk: undefined
                }
            })
            if (reload) window.location.reload();
        }
    }
}), {
    name: "subspace-wallet-connection",
    storage: createJSONStorage(() => localStorage),
    partialize: (state: WalletState) => ({
        // address: state.address,
        // connected: state.connected,
        connectionStrategy: state.connectionStrategy,
        jwk: state.jwk
    })
}));
