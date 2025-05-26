import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTrigger } from "@/components/ui/dialog"

import wander from "@/assets/logos/wander.png"
import arweave from "@/assets/logos/arweave.svg"
import metamask from "@/assets/logos/metamask.svg"
import { Button } from "./ui/button"
import { QrCode } from "lucide-react"
import { ConnectionStrategies, useWallet } from "@/hooks/use-wallet"

export default function LoginDialog({ children }: { children: React.ReactNode }) {
    const { connect } = useWallet((state) => state.actions)

    return (
        <Dialog>
            <DialogTrigger>
                {children}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    What do you want to login with?
                </DialogHeader>
                <DialogDescription className="flex flex-col gap-4 mt-4">

                    <Button variant="ghost" className="text-start group justify-start border border-border/50 h-12"
                        onClick={() => connect(ConnectionStrategies.ArWallet)}
                    >
                        <div>Arweave Wallet</div>
                        <span className="text-muted-foreground/50">(supports web3 auth)</span>
                        <img src={arweave} className="w-8 h-8 p-0.5 ml-auto aspect-square opacity-60 group-hover:opacity-100 transition-opacity duration-200 invert dark:invert-0" />
                    </Button>
                    <Button variant="ghost" className="text-start justify-start border border-border/50 h-12"
                        onClick={() => connect(ConnectionStrategies.WanderConnect)}
                    >
                        <div>Wander Connect</div>
                        <span className="text-muted-foreground/50">(supports web2 auth)</span>
                        <img src={wander} className="w-8 h-8 ml-auto aspect-square object-contain" />
                    </Button>
                    <Button variant="ghost" className="text-start !px-4 border border-border/50 h-12 justify-between"
                    // onClick={() => connect(ConnectionStrategies.ScannedJWK)}
                    >
                        <div>Scan QR Code</div>
                        <QrCode className="!h-8 !w-8 p-0.5" />
                    </Button>
                    <Button disabled variant="ghost" className="text-start !px-4 border border-border/50 h-12 justify-between">
                        <div>Metamask</div>
                        <span className="text-muted-foreground/50 text-xs">(coming soon)</span>
                        <img src={metamask} className="w-8 h-8 p-1 ml-auto aspect-square object-contain" />
                    </Button>

                </DialogDescription>
            </DialogContent>
        </Dialog>
    )
}