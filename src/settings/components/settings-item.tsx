import type { LucideIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import type { ReactNode } from 'react'

interface SettingsItemProps {
    icon: LucideIcon
    label: string
    children?: ReactNode
    onClick?: () => void
}

export function SettingsItem({ icon: Icon, label, children, onClick }: SettingsItemProps) {
    return (
        <div
            className='flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group'
            onClick={onClick}
        >
            <div className='flex items-center gap-3'>
                <Icon className='w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors' />
                <Label className='text-base font-medium group-hover:text-primary transition-colors'>{label}</Label>
            </div>
            {children}
        </div>
    )
} 