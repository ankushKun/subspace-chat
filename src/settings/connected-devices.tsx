import Arweave from 'arweave'
import QR from "qrcode"
import type { JWKInterface } from 'arweave/web/lib/wallet'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectionStrategies, useWallet } from '@/hooks/use-wallet'
import { delegate, checkDelegation, undelegate } from '@/lib/ao'
import { toast } from 'sonner'
import { Computer, Laptop2, Smartphone, X } from 'lucide-react'

interface DelegationInfo {
    success: boolean;
    is_delegatee: boolean;
    original_id: string;
    delegated_id: string | null;
}

export default function ConnectedDevices() {
    const [delegateJWK, setDelegateJWK] = useState<JWKInterface | null>(null)
    const [delegateAddress, setDelegateAddress] = useState<string | null>(null)
    const [jwkPart, setJwkPart] = useState<Record<string, string>>({})
    const [delegationInfo, setDelegationInfo] = useState<DelegationInfo | null>(null)
    const [isRemoving, setIsRemoving] = useState(false)
    const { connected, connectionStrategy, address, disconnect } = useWallet()

    // Fetch delegation info when component mounts or address changes
    useEffect(() => {
        if (!address) return;

        const fetchDelegationInfo = async () => {
            try {
                const info = await checkDelegation(address) as DelegationInfo;
                setDelegationInfo(info);
            } catch (error) {
                console.error("Failed to fetch delegation info:", error);
                toast.error("Failed to fetch delegation status");
            }
        };

        fetchDelegationInfo();
    }, [address]);

    async function genQR() {
        const ar = Arweave.init({})
        const jwk = await ar.wallets.generate()
        console.log(JSON.stringify(jwk))
        const delegate_address = await ar.wallets.jwkToAddress(jwk)
        delete jwk.kty
        delete jwk.e
        setDelegateJWK(jwk)
        setDelegateAddress(delegate_address)
    }

    async function handleRemoveDelegation(delegatedId: string) {
        if (!delegatedId) return;
        setIsRemoving(true);

        try {
            await undelegate(delegatedId);
            toast.success("Device disconnected successfully");

            // Refresh delegation info
            if (address) {
                const info = await checkDelegation(address) as DelegationInfo;
                setDelegationInfo(info);
            }
        } catch (error) {
            console.error("Failed to remove delegation:", error);
            toast.error("Failed to disconnect device");
        } finally {
            setIsRemoving(false);
        }
    }

    async function handleUndelegateCurrentDevice() {
        if (!address || !delegationInfo?.is_delegatee) return;
        setIsRemoving(true);

        try {
            await undelegate(address);
            toast.success("Device disconnected successfully");

            // Since we're disconnecting the current device, we should log out
            setTimeout(() => {
                disconnect();
            }, 1500);

        } catch (error) {
            console.error("Failed to disconnect device:", error);
            toast.error("Failed to disconnect device");
            setIsRemoving(false);
        }
    }

    useEffect(() => {
        if (!delegateJWK) return
        const interval = setInterval(() => {
            const keys = Object.keys(delegateJWK)
            const currentKey = Object.keys(jwkPart)[0] || "kty"
            const nextKeyRotating = keys[(keys.indexOf(currentKey) + 1) % keys.length]
            const nextJWKPart = { [nextKeyRotating]: delegateJWK[nextKeyRotating] }
            setJwkPart(nextJWKPart)
            QR.toCanvas(document.getElementById('qr-code')!, JSON.stringify(nextJWKPart), { width: 400 }, (error) => {
                if (error) {
                    console.error("Failed to generate QR code:", error)
                }
            })
        }, 500)
        return () => clearInterval(interval)
    }, [delegateJWK, jwkPart])

    useEffect(() => {
        if (!delegateAddress) return
        delegate(delegateAddress).then((res) => {
            console.log(res)
            toast.success("Mobile device connected successfully")
            // Refresh delegation info after successful delegation
            if (address) {
                checkDelegation(address).then((info) => setDelegationInfo(info as DelegationInfo)).catch(console.error);
            }
        }).catch((err) => {
            console.error(err)
            toast.error("Delegation failed: " + err.message)
        })
    }, [delegateAddress, address])

    // Helper to truncate long addresses
    const shortenAddress = (addr: string) => {
        if (!addr) return '';
        return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
    };

    return (
        <div className="space-y-8">
            <div>
                <p className="text-muted-foreground mb-2">
                    Here are all the devices that are currently connected to your Subspace account.
                </p>
                <p className="text-muted-foreground">
                    If you see a device you don't recognize, disconnect it immediately.
                </p>
            </div>

            {/* Current Device Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Current Device</h2>
                <div className="flex items-center justify-between p-4 rounded-md bg-secondary/30">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-secondary rounded-full">
                            {connectionStrategy === ConnectionStrategies.JWK ? (
                                <Smartphone className="w-8 h-8 text-muted-foreground" />
                            ) : (
                                <Laptop2 className="w-8 h-8 text-muted-foreground" />
                            )}
                        </div>
                        <div>
                            <div className="font-medium">
                                {connectionStrategy === ConnectionStrategies.JWK ? "Mobile PWA" : "Subspace Desktop"}
                            </div>
                            <div className="text-muted-foreground text-sm">
                                {address ? shortenAddress(address) : "Not connected"} • Active
                            </div>
                        </div>
                    </div>

                    {/* Add disconnect button for JWK connections */}
                    {connectionStrategy == ConnectionStrategies.JWK && delegationInfo?.delegated_id && (
                        <Button
                            variant="outline"
                            className='!bg-destructive/10 hover:!bg-destructive/20'
                            onClick={handleUndelegateCurrentDevice}
                            disabled={isRemoving}
                        >
                            {/* <X className="w-5 h-5" /> */}
                            LOGOUT
                        </Button>
                    )}
                </div>
            </div>

            {/* Other Devices Section - Only show when not using JWK and a delegation exists */}
            {delegationInfo && delegationInfo.delegated_id && !delegateJWK && connectionStrategy !== ConnectionStrategies.JWK && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Connected Mobile Device</h2>
                    <div className="flex items-center justify-between p-4 rounded-md bg-secondary/30">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-secondary rounded-full">
                                <Smartphone className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="font-medium">Mobile PWA</div>
                                <div className="text-muted-foreground text-sm">
                                    {shortenAddress(delegationInfo.delegated_id)} • Connected recently
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className='!bg-destructive/10 hover:!bg-destructive/20'
                            onClick={() => handleRemoveDelegation(delegationInfo.delegated_id!)}
                            disabled={isRemoving}
                        >
                            {/* <X className="w-5 h-5" /> */}
                            LOGOUT
                        </Button>
                    </div>
                </div>
            )}

            {/* Connect new device button - Only show when not using JWK */}
            {connectionStrategy !== ConnectionStrategies.JWK && (
                <div className="pt-4">
                    <div className='flex gap-2 items-center justify-start'>
                        <Button
                            variant="outline"
                            onClick={genQR}
                            disabled={!!delegateJWK || !!(delegationInfo?.delegated_id && address == delegationInfo.delegated_id)}
                            className="w-full sm:w-auto"
                        >
                            Connect a different device
                        </Button>
                        {delegationInfo && delegationInfo.delegated_id && <div className='text-xs text-muted-foreground/60'>This will disconnect the current mobile device.</div>}
                    </div>

                    {delegateJWK && (
                        <div className='mt-6 mx-auto flex flex-col gap-2 items-center justify-center rounded-lg'>
                            <canvas id="qr-code" className='rounded-lg'></canvas>
                            <div className='text-muted-foreground'>
                                Scan with the Subspace mobile app
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}