import { useEffect, useState } from 'react'
import { Moon, QrCode, Sun, X, Check, RefreshCcw, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/components/theme-provider'
import { SettingsSidebar } from '@/settings/components/settings-sidebar'
import { SettingsContent } from '@/settings/components/settings-content'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/components/theme-provider'
import s from "@/assets/s.png"
import ConnectedDevices from './connected-devices'
import { useWallet } from '@/hooks/use-wallet'

type SettingsSection = 'appearance' | 'devices'

export default function Settings() {
    const navigate = useNavigate()
    const { connected } = useWallet()
    const { theme, setTheme } = useTheme()
    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')
    const [showMobileContent, setShowMobileContent] = useState(false)

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

    const handleSectionClick = (section: SettingsSection) => {
        setActiveSection(section)
        setShowMobileContent(true)
    }

    const handleBackToSidebar = () => {
        setShowMobileContent(false)
    }

    const sidebarItems = [
        {
            icon: theme === 'dark' ? Moon : Sun,
            label: 'Appearance',
            onClick: () => handleSectionClick('appearance')
        },
        {
            icon: QrCode,
            label: 'Devices',
            onClick: () => handleSectionClick('devices')
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
                    <div className="space-y-6 md:space-y-8">
                        <h2 className="text-lg md:text-xl font-semibold">Appearance</h2>
                        <div className='flex flex-col gap-6 md:gap-10 justify-start items-start'>

                            {/* Chat Preview Box */}
                            <div className="rounded-2xl border border-border bg-muted/30 p-3 md:p-4 w-full max-w-xl shadow-sm">
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2 md:gap-3">
                                        <img src={s} alt="avatar" className="w-8 h-8 md:w-10 md:h-10 rounded-full mt-1" />
                                        <div>
                                            <span className="font-semibold text-sm md:text-base">Ankush | BetterIDEa</span>
                                            <span className="ml-2 text-xs font-light text-muted-foreground">11:57 PM</span>
                                            <div className="text-sm md:text-base">Welcome to Subspace<br />Your intergallactic communications app <span>😎</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Theme Section */}
                            <div className="space-y-2 w-full">
                                <h3 className="text-base md:text-lg font-semibold">Theme</h3>
                                <div className="text-xs md:text-sm text-muted-foreground mb-2">Adjust the color of the interface for better visibility.</div>
                                <div className="flex items-center gap-3 md:gap-4 mt-4 md:mt-8">
                                    {themeOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setTheme(opt.value)}
                                            className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center transition-all
                                            ${opt.color} ${theme === opt.value ? 'ring-1 ring-primary/40' : opt.border}
                                        `}
                                        >
                                            {theme === opt.value && <Check className="w-4 h-4 md:w-5 md:h-5 text-primary" />}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setTheme('system')}
                                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-border flex items-center justify-center hover:bg-muted/40 transition-colors"
                                        title="Reset to default"
                                    >
                                        <RefreshCcw className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 'devices':
                return <ConnectedDevices />
            default:
                return null
        }
    }

    return (
        <div className='flex flex-col md:flex-row h-screen max-h-screen w-screen gap-2 p-2 md:p-4'>
            {/* Mobile: Show either sidebar or content */}
            <div className='block md:hidden w-full h-full'>
                {showMobileContent ? (
                    <SettingsContent
                        title={activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
                        onClose={handleClose}
                        onBack={handleBackToSidebar}
                    >
                        {renderContent()}
                    </SettingsContent>
                ) : (
                    <SettingsSidebar items={sidebarItems} activeItem={activeSection} />
                )}
            </div>

            {/* Desktop: Show both sidebar and content */}
            <div className='hidden md:flex flex-row w-full h-full gap-2'>
                <SettingsSidebar items={sidebarItems} activeItem={activeSection} />
                <SettingsContent
                    title={activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
                    onClose={handleClose}
                >
                    {renderContent()}
                </SettingsContent>
            </div>
        </div>
    )
}