import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Computer, Laptop, LogOut, Monitor, Plus, QrCode, Smartphone, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWallet, ConnectionStrategies } from "@/hooks/use-wallet"
import { toast } from "sonner"
import useSubspace from "@/hooks/subspace"
import Arweave from "arweave"
import QR from "qrcode"
import type { JWKInterface } from "arweave/web/lib/wallet"
import type { DelegationDetails } from "@/types/subspace"
import { useIsMobileDevice } from "@/hooks/use-mobile"

interface ConnectedDevice {
    id: string
    name: string
    type: 'desktop' | 'mobile' | 'tablet'
    lastActive: string
    location?: string
    isCurrent: boolean
    address: string
}

export default function ConnectedDevices() {
    // address will be the main account address, originalAddress will be the local device address in case using scanned jwk
    const { address, originalAddress, connected, connectionStrategy, actions: walletActions } = useWallet()
    console.log(address, originalAddress)
    const subspace = useSubspace()
    const [devices, setDevices] = useState<ConnectedDevice[]>([])
    const [delegationDetails, setDelegationDetails] = useState<DelegationDetails | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isRemoving, setIsRemoving] = useState(false)

    // QR Code generation state
    const [delegateJWK, setDelegateJWK] = useState<JWKInterface | null>(null)
    const [delegateAddress, setDelegateAddress] = useState<string | null>(null)
    const [jwkPart, setJwkPart] = useState<Record<string, string>>({})

    const isMobileDevice = useIsMobileDevice()

    // Function to refresh delegation status and update UI
    const refreshDelegationStatus = async () => {
        if (!address) return

        try {
            const devicesList: ConnectedDevice[] = []

            // Rule 1: If originalAddress != address and both exist, account is delegated on mobile
            if (originalAddress && originalAddress !== address) {
                // This is a delegated account used on mobile
                // Show desktop (main account) and mobile (delegated account)
                devicesList.push({
                    id: 'desktop',
                    name: 'Subspace Desktop',
                    type: 'desktop',
                    lastActive: 'Connected',
                    isCurrent: false,
                    address: address // main account address
                })

                devicesList.push({
                    id: 'mobile',
                    name: 'Mobile PWA',
                    type: 'mobile',
                    lastActive: 'Active now',
                    isCurrent: true,
                    address: originalAddress // delegated address
                })

                // Set delegation details for UI state
                setDelegationDetails({
                    isDelegatee: true,
                    originalId: address,
                    delegatedId: originalAddress
                })
            } else {
                // Rule 2: originalAddress doesn't exist, fetch delegation details
                const details = await subspace.user.getDelegationDetails({ userId: address })
                setDelegationDetails(details)

                // Always show current device first
                devicesList.push({
                    id: 'current',
                    name: isMobileDevice ? 'Mobile PWA' : 'Subspace Desktop',
                    type: isMobileDevice ? 'mobile' : 'desktop',
                    lastActive: 'Active now',
                    isCurrent: true,
                    address: address
                })

                // Show the other device if delegation exists
                if (details) {
                    if (details.isDelegatee && !isMobileDevice) {
                        // Current device is desktop but it's actually a delegated account
                        // This shouldn't happen in normal flow, but handle it
                        devicesList[0].address = details.delegatedId || address

                        // Add the original desktop device
                        devicesList.push({
                            id: 'original',
                            name: 'Subspace Desktop',
                            type: 'desktop',
                            lastActive: 'Connected',
                            isCurrent: false,
                            address: details.originalId
                        })
                    } else if (details.delegatedId && !isMobileDevice) {
                        // Current is desktop (main account), add the delegated mobile
                        devicesList.push({
                            id: 'delegated',
                            name: 'Mobile PWA',
                            type: 'mobile',
                            lastActive: 'Connected',
                            isCurrent: false,
                            address: details.delegatedId
                        })
                    } else if (details.isDelegatee && isMobileDevice) {
                        // Current device is mobile and it's delegated
                        // Add the original desktop device
                        devicesList.push({
                            id: 'original',
                            name: 'Subspace Desktop',
                            type: 'desktop',
                            lastActive: 'Connected',
                            isCurrent: false,
                            address: details.originalId
                        })
                    }
                }
            }

            setDevices(devicesList)
        } catch (error) {
            console.error("Failed to fetch delegation details:", error)
            toast.error("Failed to fetch delegation status")
        }
    }

    // Check delegation details and update wallet state (similar to main app logic)
    useEffect(() => {
        console.log("connectionStrategy", connectionStrategy, connected, address)
        if (!connected || !address) return
        (async () => {
            if ((connectionStrategy === ConnectionStrategies.ScannedJWK) && address) {
                const delegationDetails = await subspace.user.getDelegationDetails({ userId: address })
                console.log("Delegation details in settings:", delegationDetails)
                // If the scanned address has a delegation and we should be using the delegated address
                if (delegationDetails && delegationDetails.isDelegatee && delegationDetails.originalId) {
                    // This means the scanned address is the delegatedId and we should use the originalId
                    walletActions.updateAddress(delegationDetails.originalId)
                }
                if (!delegationDetails?.delegatedId) {
                    walletActions.disconnect()
                    toast.error("Account disconnected, please scan the QR code again")
                }
            }
        })()
    }, [connected, connectionStrategy, address, subspace, walletActions])

    // Fetch delegation details when component mounts or address changes
    useEffect(() => {
        refreshDelegationStatus()
    }, [address, originalAddress, connectionStrategy, subspace, isMobileDevice])

    // QR Code rotation effect
    useEffect(() => {
        if (!delegateJWK) return

        const interval = setInterval(() => {
            const keys = Object.keys(delegateJWK)
            const currentKey = Object.keys(jwkPart)[0] || "n"
            const nextKeyIndex = (keys.indexOf(currentKey) + 1) % keys.length
            const nextKey = keys[nextKeyIndex]
            const nextJWKPart = { [nextKey]: delegateJWK[nextKey] }
            setJwkPart(nextJWKPart)

            const canvas = document.getElementById('qr-code') as HTMLCanvasElement
            if (canvas) {
                QR.toCanvas(canvas, JSON.stringify(nextJWKPart), { width: 400 }, (error) => {
                    if (error) {
                        console.error("Failed to generate QR code:", error)
                    }
                })
            }
        }, 500)

        return () => clearInterval(interval)
    }, [delegateJWK, jwkPart])

    // Auto-delegate when new address is generated
    useEffect(() => {
        if (!delegateAddress) return

        // Use the main account address for delegation (the one that owns/delegates)
        // For scanned JWK: address = main account, originalAddress = local device
        const delegatorAddress = address
        if (!delegatorAddress) return

        const performDelegation = async () => {
            try {
                const success = await subspace.user.delegateUser({ userId: delegateAddress })
                if (success) {
                    toast.success("Mobile device added successfully")
                    if (process.env.NODE_ENV === "development") {
                        console.log(JSON.stringify(delegateJWK))
                    }
                    // Refresh delegation details and update UI
                    await refreshDelegationStatus()
                    // Don't clear QR generation state - let user close it manually
                } else {
                    throw new Error("Delegation failed")
                }
            } catch (error) {
                console.error("Delegation failed:", error)
                toast.error("Delegation failed: " + (error as Error).message)
                // Clear QR generation state on error
                setDelegateJWK(null)
                setDelegateAddress(null)
                setJwkPart({})
            }
        }

        performDelegation()
    }, [delegateAddress, address, subspace])

    const getDeviceIcon = (type: string, isCurrent: boolean) => {
        const iconClass = cn(
            "w-5 h-5",
            isCurrent ? "text-primary" : "text-muted-foreground"
        )

        switch (type) {
            case 'desktop':
                return <Monitor className={iconClass} />
            case 'mobile':
                return <Smartphone className={iconClass} />
            case 'tablet':
                return <Computer className={iconClass} />
            default:
                return <Laptop className={iconClass} />
        }
    }

    const handleDisconnectDevice = async (device: ConnectedDevice) => {
        if (device.isCurrent) return

        setIsRemoving(true)
        try {
            const success = await subspace.user.undelegateUser()
            if (success) {
                toast.success("Device disconnected successfully")
                // Refresh delegation details and update UI
                await refreshDelegationStatus()
            } else {
                throw new Error("Failed to disconnect device")
            }
        } catch (error) {
            console.error("Failed to disconnect device:", error)
            toast.error("Failed to disconnect device")
        } finally {
            setIsRemoving(false)
        }
    }

    const handleDisconnectCurrentDevice = async () => {
        // Only allow disconnecting current device if it's a delegated mobile device
        if (!(originalAddress && originalAddress !== address)) return

        setIsRemoving(true)
        try {
            const success = await subspace.user.undelegateUser()
            if (success) {
                toast.success("Device disconnected successfully")
                // Since we're disconnecting the current delegated device, log out after a delay
                setTimeout(() => {
                    walletActions.disconnect()
                }, 1500)
            } else {
                throw new Error("Failed to disconnect device")
            }
        } catch (error) {
            console.error("Failed to disconnect device:", error)
            toast.error("Failed to disconnect device")
            setIsRemoving(false)
        }
    }

    const handleConnectNewDevice = async () => {
        setIsConnecting(true)
        try {
            const ar = Arweave.init({})
            const jwk = await ar.wallets.generate()
            const newAddress = await ar.wallets.jwkToAddress(jwk)

            // Remove kty and e properties for QR rotation (as per legacy implementation)
            const jwkForQR = { ...jwk }
            delete jwkForQR.kty
            delete jwkForQR.e

            setDelegateJWK(jwkForQR)
            setDelegateAddress(newAddress)
        } catch (error) {
            console.error("Failed to generate QR code:", error)
            toast.error("Failed to generate QR code")
        } finally {
            setIsConnecting(false)
        }
    }

    const shortenAddress = (addr: string) => {
        if (!addr) return ''
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
    }

    if (!connected || !(address)) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <Wifi className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Not Connected</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                    Connect your wallet to view and manage your connected devices.
                </p>
            </div>
        )
    }

    // For scanned JWK: address = main account, originalAddress = local device
    // For other strategies: address = current account, originalAddress may not exist
    const mainAccountAddress = address
    const currentDeviceAddress = address

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Connected Devices</h2>
                <p className="text-sm text-muted-foreground">
                    Here are all the devices that are currently connected to your Subspace account.
                    If you see a device you don't recognize, disconnect it immediately.
                </p>
            </div>

            {/* Current Account Info */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium text-foreground">Connected as</span>
                </div>
                <div className="text-sm text-muted-foreground font-mono">
                    {shortenAddress(address)}
                </div>
                {originalAddress && originalAddress !== address && (
                    <div className="text-xs text-muted-foreground mt-1">
                        Device address: {shortenAddress(originalAddress)}
                    </div>
                )}
                {originalAddress && originalAddress !== address && (
                    <div className="text-xs text-muted-foreground mt-1">
                        Delegated from: {shortenAddress(address)}
                    </div>
                )}
            </div>

            {/* Devices List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-foreground">Your Devices</h3>
                    {!(originalAddress && originalAddress !== address) && !delegateJWK && (
                        <Button
                            onClick={handleConnectNewDevice}
                            disabled={isConnecting}
                            className="gap-2"
                            size="sm"
                        >
                            <Plus className="w-4 h-4" />
                            {isConnecting ? "Generating..." : "Connect Device"}
                        </Button>
                    )}
                </div>

                <div className="space-y-3">
                    {devices.map((device) => (
                        <div
                            key={device.id}
                            className={cn(
                                "p-4 rounded-xl border transition-all duration-200",
                                device.isCurrent
                                    ? "bg-primary/5 border-primary/20 shadow-sm"
                                    : "bg-card border-border hover:bg-accent/30"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Device Icon */}
                                    <div className={cn(
                                        "p-3 rounded-lg",
                                        device.isCurrent
                                            ? "bg-primary/10"
                                            : "bg-muted/50"
                                    )}>
                                        {getDeviceIcon(device.type, device.isCurrent)}
                                    </div>

                                    {/* Device Info */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-foreground">{device.name}</h4>
                                            {device.isCurrent && (
                                                <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>{device.lastActive}</span>
                                            <span>•</span>
                                            <span className="font-mono">{shortenAddress(device.address)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                {device.isCurrent && (originalAddress && originalAddress !== address) ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDisconnectCurrentDevice}
                                        disabled={isRemoving}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        {isRemoving ? "Disconnecting..." : "Logout"}
                                    </Button>
                                ) : !device.isCurrent && device.type === 'mobile' ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDisconnectDevice(device)}
                                        disabled={isRemoving}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* QR Code Generation */}
            {delegateJWK && (
                <div className="p-6 rounded-xl border border-primary/20 bg-primary/5">
                    <div className="text-center space-y-4">
                        <h4 className="font-medium text-foreground">
                            {delegationDetails?.delegatedId === delegateAddress ? "Device Connected!" : "Scan QR Code"}
                        </h4>
                        <div className="flex justify-center">
                            <canvas
                                id="qr-code"
                                className="rounded-lg border border-border max-w-full"
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Scan this QR code with the Subspace mobile app to connect your device. Once connected, you can close this QR code.
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDelegateJWK(null)
                                setDelegateAddress(null)
                                setJwkPart({})
                            }}
                            className="w-full"
                        >
                            {delegationDetails?.delegatedId === delegateAddress ? "Close" : "Cancel"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Connect New Device Section - Only show when not generating QR */}
            {!delegateJWK && !(originalAddress && originalAddress !== address) && (
                <div className="p-6 rounded-xl border border-dashed border-border/50 bg-muted/20">
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                            <QrCode className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                            <h4 className="font-medium text-foreground mb-1">Connect a New Device</h4>
                            <p className="text-sm text-muted-foreground">
                                {delegationDetails?.delegatedId
                                    ? "This will disconnect the current mobile device and connect a new one."
                                    : "Scan a QR code with the Subspace mobile app to connect a new device to your account."
                                }
                            </p>
                            {delegationDetails?.delegatedId && (
                                <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        <strong>Note:</strong> Only one mobile device can be connected at a time. Adding a new device will automatically disconnect your current mobile device.
                                    </p>
                                </div>
                            )}
                        </div>
                        <Button
                            onClick={handleConnectNewDevice}
                            disabled={isConnecting}
                            variant="outline"
                            className="gap-2"
                        >
                            <QrCode className="w-4 h-4" />
                            {isConnecting ? "Generating..." : delegationDetails?.delegatedId ? "Connect Different Device" : "Generate QR Code"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Security Notice */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                    </div>
                    <div>
                        <h4 className="font-medium text-foreground mb-1">Security Notice</h4>
                        <p className="text-sm text-muted-foreground">
                            Only connect devices you trust. If you see any unfamiliar devices,
                            disconnect them immediately.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
} 