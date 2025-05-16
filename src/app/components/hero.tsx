import { ModeToggle } from "@/components/mode-toggle";
import sLogo from "@/assets/s.png"
import { useEffect, useState } from "react";
import NotificationsPanel from "./notifications-panel";

export default function Hero() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className='w-full h-full flex flex-col items-center justify-center select-none'>
            <div className="absolute top-4 right-4 flex ">
                <NotificationsPanel />
            </div>
            <img src={sLogo} className='w-24 h-24 drop-shadow-lg drop-shadow-foreground/20' draggable={false} />
            <div className="text-4xl font-bold text-foreground/70">Subspace Chat</div>
            <p className="text-sm mt-2 text-muted-foreground">Your intergalactic communications system</p>
            <div className="h-20" />

            {!isOnline ? (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium text-destructive">No internet connection</p>
                    <p className="text-xs text-muted-foreground">Please check your connection and try again</p>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Join a server to start talking
                </p>
            )}
        </div>
    )
}