import { ModeToggle } from "@/components/mode-toggle";
import sLogo from "@/assets/s.png"

export default function Hero() {
    return (
        <div className='w-full h-full flex flex-col items-center justify-center select-none'>
            <ModeToggle className="absolute top-4 right-4" />
            <img src={sLogo} className='w-24 h-24 drop-shadow-lg drop-shadow-foreground/20' draggable={false} />
            <div className="text-4xl font-bold text-foreground/70">Subspace Chat</div>
            <p className="text-sm mt-2 text-muted-foreground">Your intergalactic communications system</p>
            <div className="h-20" />

            <p className="text-sm text-muted-foreground">
                Join a server to start talking
            </p>
        </div>
    )
}