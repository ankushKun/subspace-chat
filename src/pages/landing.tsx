import { Button } from "@/components/ui/button"
import { ThemeToggleButton } from "@/components/theme-toggle"
import LoginDialog from "../components/login-dialog"
import { useIsMobile } from "../hooks/use-mobile"
import { useWallet } from "@/hooks/use-wallet"

import s1 from "@/assets/s1.png"
import s2 from "@/assets/s2.png"
import chk from "@/assets/chkthisout.png"
import { ExternalLink } from "lucide-react"
import { Link, NavLink } from "react-router"


export default function SubspaceLanding() {
    const isMobile = useIsMobile()
    const connected = useWallet((state) => state.connected)

    // force this page to always be in light mode
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            {connected ? <NavLink to="/app"><Button className="absolute top-8 right-6 z-20 font-bold">Go Subspace <ExternalLink /></Button></NavLink>
                : <LoginDialog>
                    <Button className="absolute top-6 right-6 z-20 font-bold">Login</Button>
                </LoginDialog>}

            <ThemeToggleButton className="absolute top-4 left-4 z-20" />

            <div className="h-screen relative flex flex-col items-center justify-center">
                <div className="font-ka text-5xl sm:text-7xl md:text-8xl tracking-wider drop-shadow-2xl drop-shadow-primary/40">SUBSPACE</div>
                <div className="font-vipnagorgialla tracking-wider text-xs sm:text-sm md:text-xl scale-y-130 mt-2.5 drop-shadow-xl">Intergalactic Communicator</div>
            </div>
            <div className="flex -mt-22 flex-col h- mx-auto overflow-x-clip max-w-screen min-w-screen z-20 items-center justify-start gap-2">
                <img draggable={false} className="absolute w-80 right-[8vw] -translate-y-36 z-20 invert dark:invert-0 drop-shadow-xl" src={chk} />
                <img draggable={false} src={isMobile ? s2 : s1} className="w-[90vw] overflow-clip -rotate-12 md:rotate-0 md:w-[80vw] rounded-xl object-cover drop-shadow-2xl" />
            </div>
            <div className="flex flex-col items-center justify-center gap-2 my-52 pb-14">
                {(() => {
                    const Btn = <Button className="z-20 md:p-10 drop-shadow-2xl tracking-wider px-14 bg-primary text-primary-foreground hover:bg-primary-foreground font-ka 
                    md:text-3xl hover:text-primary transform hover:scale-110 transition duration-500">Start Talking</Button>
                    return connected ? <NavLink to="/app">{Btn}</NavLink> : <LoginDialog>{Btn}</LoginDialog>
                })()}
            </div>
            <div className="flex flex-col bg-primary w-full p-6 gap-4">
                {/* <div className="flex flex-col items-center justify-center gap-2">
                    <div className="font-ka text-3xl tracking-widest">Subspace</div>
                </div> */}
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="font-ka tracking-widest">powered by <Link draggable={false} target="_blank" to="https://x.com/aoTheComputer" className="hover:underline underline-offset-8 hover:text-white">aoTheComputer</Link></div>
                </div>
            </div>
        </div>
    )
}
