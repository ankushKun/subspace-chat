import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useConnection } from 'arwalletkit-react'
import { Button } from '@/components/ui/button'
import { NotificationSettings } from '@/settings/components/notification'
import { createLogger, getLogLevel, LogLevel, setLogLevel } from '@/lib/logger'

// Create a logger for this module
const logger = createLogger('settings');

export default function Settings() {
    const navigate = useNavigate()
    const { connected } = useConnection();

    useEffect(() => {
        const t = setTimeout(() => {
            if (!connected) {
                logger.warn("not connected, redirecting to landing")
                navigate("/");
            }
        }, 200);
        return () => clearTimeout(t);
    }, [connected]);

    const handleClose = () => {
        navigate('/app')
    }

    return (
        <div className='flex h-screen max-h-screen w-screen gap-2 p-2'>
            <div className='w-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2'>
                <div className='w-full flex items-center justify-between p-4 border-b border-border/30'>
                    <div className='text-xl font-medium ml-2'>Settings</div>
                    <Button
                        onClick={handleClose}
                        variant="ghost"
                        size="icon"
                        className=' p-1 text-xs text-muted-foreground'
                    >
                        <X className='h-4 w-4' />
                    </Button>
                </div>
                <div className='w-full flex-1 p-4'>
                    <NotificationSettings />
                    <hr className="my-6 border-gray-200 dark:border-gray-700" />
                    <DebugSettings />
                </div>
            </div>
        </div>
    )
}

// Add a new component for Debug Settings
function DebugSettings() {
    const [logLevel, setLogLevelState] = useState(getLogLevel());

    const handleLogLevelChange = (level: LogLevel) => {
        setLogLevel(level);
        setLogLevelState(level);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Console Logging Level</h3>
                <p className="text-sm text-muted-foreground">
                    Control the amount of logs shown in the browser console.
                </p>
                <div className="flex flex-col gap-2 mt-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant={logLevel === LogLevel.NONE ? "default" : "outline"}
                            onClick={() => handleLogLevelChange(LogLevel.NONE)}
                            className="w-full"
                        >
                            None (Disable all logs)
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={logLevel === LogLevel.ERROR ? "default" : "outline"}
                            onClick={() => handleLogLevelChange(LogLevel.ERROR)}
                            className="w-full"
                        >
                            Errors Only
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={logLevel === LogLevel.WARN ? "default" : "outline"}
                            onClick={() => handleLogLevelChange(LogLevel.WARN)}
                            className="w-full"
                        >
                            Warnings & Errors
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={logLevel === LogLevel.INFO ? "default" : "outline"}
                            onClick={() => handleLogLevelChange(LogLevel.INFO)}
                            className="w-full"
                        >
                            Info, Warnings & Errors
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={logLevel === LogLevel.DEBUG ? "default" : "outline"}
                            onClick={() => handleLogLevelChange(LogLevel.DEBUG)}
                            className="w-full"
                        >
                            All Logs (Debug)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}