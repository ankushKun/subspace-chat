import { useEffect, useState } from 'react'
import { Moon, QrCode, Sun, X, Check, RefreshCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useConnection } from '@arweave-wallet-kit/react'
import { useTheme } from '@/components/theme-provider'
import { SettingsSidebar } from '@/settings/components/settings-sidebar'
import { SettingsContent } from '@/settings/components/settings-content'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/components/theme-provider'
import s from "@/assets/s.png"

type SettingsSection = 'appearance' | 'devices'

export default function Settings() {
    const navigate = useNavigate()
    const { connected } = useConnection()
    const { theme, setTheme } = useTheme()
    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')

    useEffect(() => {
        const t = setTimeout(() => {
            if (!connected) {
                navigate("/")
            }
        }, 200)
        return () => clearTimeout(t)
    }, [connected])

    const handleClose = () => {
        navigate('/app')
    }

    const sidebarItems = [
        {
            icon: theme === 'dark' ? Moon : Sun,
            label: 'Appearance',
            onClick: () => setActiveSection('appearance')
        },
        {
            icon: QrCode,
            label: 'Devices',
            onClick: () => setActiveSection('devices')
        }
    ]

    const themeOptions = [
        { value: 'light' as Theme, color: 'bg-white', border: 'border-zinc-300' },
        { value: 'dark' as Theme, color: 'bg-black', border: 'border-zinc-900' },
    ]

    const renderContent = () => {
        switch (activeSection) {
            case 'appearance':
                return (
                    <div className="space-y-8">
                        <h2 className="text-xl font-semibold">Appearance</h2>
                        <div className='flex flex-col gap-10 justify-start items-start'>

                            {/* Chat Preview Box */}
                            <div className="rounded-2xl border border-border bg-muted/30 p-4 w-full max-w-xl shadow-sm">
                                <div className="space-y-2">
                                    <div className="flex items-start gap-3">
                                        <img src={s} alt="avatar" className="w-10 h-10 rounded-full mt-1" />
                                        <div>
                                            <span className="font-semibold">Ankush | BetterIDEa</span>
                                            <span className="ml-2 text-xs font-light text-muted-foreground">11:57 PM</span>
                                            <div>Welcome to Subspace<br />Your intergallactic communications app <span>😎</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Theme Section */}
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold">Theme</h3>
                                <div className="text-sm text-muted-foreground mb-2">Adjust the color of the interface for better visibility.</div>
                                <div className="flex items-center gap-4 mt-8">
                                    {themeOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setTheme(opt.value)}
                                            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all
                                            ${opt.color} ${theme === opt.value ? 'ring-1 ring-primary/40' : opt.border}
                                        `}
                                        >
                                            {theme === opt.value && <Check className="w-5 h-5 text-primary" />}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setTheme('system')}
                                        className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center hover:bg-muted/40 transition-colors"
                                        title="Reset to default"
                                    >
                                        <RefreshCcw className="w-5 h-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 'devices':
                return (
                    <div className="space-y-4">
                        <h2 className="text-lg font-medium">Connected Devices</h2>
                        <p className="text-muted-foreground">Manage your connected devices here.</p>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className='flex h-screen max-h-screen w-screen gap-2 p-4'>
            <SettingsSidebar items={sidebarItems} activeItem={activeSection} />
            <SettingsContent title={activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} onClose={handleClose}>
                {renderContent()}
            </SettingsContent>
        </div>
    )
}