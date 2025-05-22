import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SettingsItemProps {
    icon: LucideIcon
    label: string
    children?: ReactNode
    onClick?: () => void
    active?: boolean
}

export function SettingsItem({ icon: Icon, label, children, onClick, active }: SettingsItemProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors
                ${active
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                }
            `}
        >
            <Icon className="w-5 h-5" />
            <span className="text-sm">{label}</span>
        </button>
    )
} 