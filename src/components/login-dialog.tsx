import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTrigger } from "@/components/ui/dialog"

import wander from "@/assets/logos/wander.png"
import arweave from "@/assets/logos/arweave.svg"
import metamask from "@/assets/logos/metamask.svg"
import { Button } from "./ui/button"
import { QrCode } from "lucide-react"
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet"
import { useState, useEffect } from "react"
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import type { JWKInterface } from "arweave/web/lib/wallet";
import { toast } from "sonner";
import { Progress } from "./ui/progress";
import { useIsMobileDevice } from "@/hooks/use-mobile"
import useSubspace from "@/hooks/subspace"

const totalScanSteps = 7;

export default function LoginDialog({ children }: { children: React.ReactNode }) {
    const [scanning, setScanning] = useState(false)
    const [scannedJWK, setScannedJWK] = useState<Record<string, any>>({})
    const [scanProgress, setScanProgress] = useState(0)
    const { address, actions: walletActions, connected, connectionStrategy } = useWallet()
    const isMobileDevice = useIsMobileDevice()
    const subspace = useSubspace()

    function handleScan(detectedCodes: IDetectedBarcode[]) {
        const raw = detectedCodes[0]?.rawValue
        if (raw) {
            try {
                const data = JSON.parse(raw) as Record<string, any>
                const key = Object.keys(data)[0]
                const value = data[key]

                setScannedJWK(prev => {
                    const newJWK = { ...prev, [key]: value }
                    const newProgress = Object.keys(newJWK).length
                    setScanProgress(newProgress)
                    return newJWK
                })
            } catch (error) {
                console.error("Failed to parse QR code data:", error)
            }
        }
    }

    useEffect(() => {
        if (scanProgress === totalScanSteps) {
            // Add required JWK properties
            const completeJWK = {
                ...scannedJWK,
                kty: "RSA",
                e: "AQAB"
            } as JWKInterface

            // Check if all required keys are present
            const requiredKeys = ["kty", "e", "n", "d", "p", "q", "dp", "dq", "qi"]
            const allKeysPresent = requiredKeys.every(key => completeJWK[key])

            if (allKeysPresent) {
                console.log("All required keys are present, connecting...")
                try {
                    walletActions.connect(ConnectionStrategies.ScannedJWK, completeJWK)
                    toast.success("Wallet connected successfully!")
                    // Reset state after successful connection
                    setScanning(false)
                    setScannedJWK({})
                    setScanProgress(0)
                } catch (error) {
                    console.error("Failed to connect with scanned JWK:", error)
                    toast.error("Failed to connect with scanned wallet")
                    // Reset scanning state on error
                    setScanning(false)
                    setScannedJWK({})
                    setScanProgress(0)
                }
            } else {
                console.error("Missing required JWK keys:", requiredKeys.filter(key => !completeJWK[key]))
                toast.error("Incomplete wallet data scanned")
                // Reset scanning state
                setScanning(false)
                setScannedJWK({})
                setScanProgress(0)
            }
        }
    }, [scanProgress, scannedJWK, walletActions.connect])

    return (
        <Dialog onOpenChange={(open) => {
            if (!open) {
                setScanning(false)
                setScannedJWK({})
                setScanProgress(0)
            }
        }}>
            <DialogTrigger>
                {children}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    What do you want to login with?
                </DialogHeader>
                <DialogDescription className="flex flex-col gap-4 mt-4">
                    {scanning ? <>
                        <div className="space-y-4">
                            <div className="relative">
                                <Scanner
                                    constraints={{ facingMode: "environment" }}
                                    classNames={{
                                        container: "w-full max-w-sm md:!max-w-md mx-auto flex items-center justify-center rounded"
                                    }}
                                    onScan={handleScan}
                                    formats={["qr_code"]}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Scanning progress</span>
                                    <span>{scanProgress}/{totalScanSteps}</span>
                                </div>
                                <Progress value={(scanProgress / totalScanSteps) * 100} className="w-full" />
                                <div className="text-center text-xs text-muted-foreground">
                                    Scan all {totalScanSteps} QR codes from subspace on desktop
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setScanning(false)}
                            className="w-full"
                        >
                            Cancel Scanning
                        </Button>
                    </> : <>
                        {window && window.arweaveWallet && <Button variant="ghost" className="text-start group justify-start border border-border/50 h-12"
                            onClick={() => walletActions.connect(ConnectionStrategies.ArWallet)}
                        >
                            <div>Arweave Wallet</div>
                            <span className="text-muted-foreground/50">(wallet extension)</span>
                            <img src={arweave} className="w-8 h-8 p-0.5 ml-auto aspect-square opacity-60 group-hover:opacity-100 transition-opacity duration-200 invert dark:invert-0" />
                        </Button>}
                        <Button variant="ghost" className="text-start justify-start border border-border/50 h-12"
                            onClick={() => walletActions.connect(ConnectionStrategies.WanderConnect)}
                        >
                            <div>Wander Connect</div>
                            <span className="text-muted-foreground/50">(web2 auth)</span>
                            <img src={wander} className="w-8 h-8 ml-auto aspect-square object-contain" />
                        </Button>
                        {isMobileDevice && <Button variant="ghost" className="text-start !px-4 border border-border/50 h-12 justify-between"
                            onClick={() => setScanning(true)}
                        >
                            <div>Scan QR Code</div>
                            <QrCode className="!h-8 !w-8 p-0.5" />
                        </Button>}
                        <Button disabled variant="ghost" className="text-start !px-4 border border-border/50 h-12 justify-between">
                            <div>Metamask</div>
                            <span className="text-muted-foreground/50 text-xs">(coming soon)</span>
                            <img src={metamask} className="w-8 h-8 p-1 ml-auto aspect-square object-contain" />
                        </Button>

                        {process.env.NODE_ENV === "development" && <Button variant="ghost" className="text-start !px-4 border border-border/50 h-12 justify-between mt-5"
                            onClick={() => {
                                // prompt input for a jwk string
                                const jwk = prompt("Enter the JWK string")
                                if (jwk) {
                                    const jwkObj = JSON.parse(jwk)
                                    jwkObj.kty = "RSA"
                                    jwkObj.e = "AQAB"
                                    walletActions.connect(ConnectionStrategies.ScannedJWK, jwkObj)
                                }
                            }}
                        >
                            simulate delegation <span className="text-muted-foreground/50 text-xs">(dev only)</span>
                        </Button>}
                    </>}
                </DialogDescription>
            </DialogContent>
        </Dialog>
    )
}