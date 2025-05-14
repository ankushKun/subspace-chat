import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useConnection } from '@arweave-wallet-kit/react'
import { Button } from '@/components/ui/button'

export default function Settings() {
    const navigate = useNavigate()
    const { connected } = useConnection();

    useEffect(() => {
        const t = setTimeout(() => {
            if (!connected) {
                console.log("not connected, redirecting to landing")
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
                    {/* Settings content will go here */}
                    <div className='text-center text-muted-foreground py-8'>
                        <p className='text-sm'>Settings coming soon!</p>
                    </div>
                </div>
            </div>
        </div>
    )
}