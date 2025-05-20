import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

interface SettingsContentProps {
    title: string
    children: ReactNode
    onClose?: () => void
}

export function SettingsContent({ title, children, onClose }: SettingsContentProps) {
    return (
        <div className='flex-1 h-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2 shadow-lg'>
            <div className='w-full flex items-center justify-between p-4 border-b border-border/30'>
                <div className='text-xl font-semibold ml-2'>{title}</div>
                {onClose && (
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        size="icon"
                        className='hover:bg-muted/50 p-1 text-xs text-muted-foreground transition-colors'
                    >
                        <X className='h-4 w-4' />
                    </Button>
                )}
            </div>
            <div className='w-full flex-1 p-6'>
                {children}
            </div>
        </div>
    )
} 