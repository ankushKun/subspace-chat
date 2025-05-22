import type { LucideIcon } from 'lucide-react'
import { SettingsItem } from './settings-item'

interface SettingsSidebarProps {
    items: {
        icon: LucideIcon
        label: string
        onClick?: () => void
    }[]
    activeItem?: string
}

export function SettingsSidebar({ items, activeItem }: SettingsSidebarProps) {
    return (
        <div className='w-full md:w-64 h-full bg-muted/30 rounded-lg flex flex-col items-center justify-start gap-2 shadow-lg'>
            <div className='w-full flex items-center justify-between p-3 md:p-4 border-b border-border/30'>
                <div className='text-lg md:text-xl font-semibold ml-2'>Settings</div>
            </div>
            <div className='w-full flex-1 p-2 md:p-4 flex flex-col gap-1 md:gap-2'>
                {items.map((item) => (
                    <SettingsItem
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        onClick={item.onClick}
                        active={item.label.toLowerCase() === activeItem}
                    />
                ))}
            </div>
        </div>
    )
} 