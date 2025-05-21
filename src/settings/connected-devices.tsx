import Arweave from 'arweave'
import QR from "qrcode"
import type { JWKInterface } from 'arweave/web/lib/wallet'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectionStrategies, useWallet } from '@/hooks/use-wallet'

export default function ConnectedDevices() {
    const [delegateJWK, setDelegateJWK] = useState<JWKInterface | null>(null)
    const [delegateAddress, setDelegateAddress] = useState<string | null>(null)
    const [jwkPart, setJwkPart] = useState<Record<string, string>>({})
    const { connected, connectionStrategy } = useWallet()

    async function genQR() {
        const ar = Arweave.init({})
        const jwk = await ar.wallets.generate()
        const delegate_address = await ar.wallets.jwkToAddress(jwk)
        delete jwk.kty
        delete jwk.e
        setDelegateJWK(jwk)
        setDelegateAddress(delegate_address)
    }

    useEffect(() => {
        if (!delegateJWK) return
        const interval = setInterval(() => {
            // iterate over and set jwk part to one key value pair in jwk one by one
            const keys = Object.keys(delegateJWK)
            const currentKey = Object.keys(jwkPart)[0] || "kty"
            const nextKeyRotating = keys[(keys.indexOf(currentKey) + 1) % keys.length]
            const nextJWKPart = { [nextKeyRotating]: delegateJWK[nextKeyRotating] }
            setJwkPart(nextJWKPart)
            // console.log(nextKeyRotating)
            QR.toCanvas(document.getElementById('qr-code')!, JSON.stringify(nextJWKPart), { width: 400 }, (error) => {
                if (error) {
                    console.error("Failed to generate QR code:", error)
                }
            })
        }, 500)
        return () => clearInterval(interval)
    }, [delegateJWK, jwkPart])


    return (
        <div className="space-y-4">
            <h2 className="text-lg font-medium">Connected Devices</h2>
            <p className="text-muted-foreground">Manage your connected device here.</p>

            <Button variant="outline" onClick={genQR} disabled={!!delegateJWK || connectionStrategy == ConnectionStrategies.JWK}>
                {connectionStrategy == ConnectionStrategies.JWK ? "Already Connected" : "Generate QR"}
            </Button>
            {delegateJWK && <div className='mx-auto flex flex-col gap-2 items-center justify-center rounded-lg'>
                <canvas id="qr-code" className='rounded-lg'></canvas>
                <div className='text-muted-foreground/60'>
                    Scan this using subspace.ar.io on any supported mobile device
                </div>
            </div>}
        </div>
    )
}