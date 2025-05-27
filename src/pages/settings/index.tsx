import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Monitor, Moon, Smartphone, Sun, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { NavLink } from "react-router"
import ConnectedDevices from "./components/connected-devices"

type SettingsSection = 'appearance' | 'devices'

export default function Settings() {
    const { theme, setTheme } = useTheme()
    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')

    const sidebarItems = [
        {
            id: 'appearance' as const,
            label: 'Appearance',
            icon: theme === 'dark' ? Moon : Sun,
            description: 'Customize your theme'
        },
        {
            id: 'devices' as const,
            label: 'Connected Devices',
            icon: Smartphone,
            description: 'Manage your devices'
        }
    ]

    const themeOptions = [
        {
            id: 'light' as const,
            label: 'Light',
            description: 'A clean, bright theme',
            icon: Sun,
            preview: 'bg-white border-gray-300'
        },
        {
            id: 'dark' as const,
            label: 'Dark',
            description: 'Easy on the eyes',
            icon: Moon,
            preview: 'bg-gray-900 border-gray-700'
        },
        // {
        //     id: 'system' as const,
        //     label: 'System',
        //     description: 'Matches your device',
        //     icon: Monitor,
        //     preview: 'bg-gradient-to-br from-white to-gray-900 border-gray-500'
        // }
    ]

    const renderContent = () => {
        switch (activeSection) {
            case 'appearance':
                return (
                    <div className="space-y-8">
                        {/* Theme Section */}
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-foreground mb-2">Theme</h2>
                                <p className="text-sm text-muted-foreground">
                                    Choose how Subspace looks to you. Select a single theme, or sync with your system and automatically switch between day and night themes.
                                </p>
                            </div>

                            <div className="grid gap-4">
                                {themeOptions.map((option) => (
                                    <div
                                        key={option.id}
                                        className={cn(
                                            "relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:bg-accent/30",
                                            theme === option.id
                                                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                                : "border-border hover:border-border/80"
                                        )}
                                        onClick={() => setTheme(option.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Theme Preview */}
                                            <div className={cn(
                                                "w-12 h-12 rounded-lg border-2 flex items-center justify-center",
                                                option.preview
                                            )}>
                                                <option.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                            </div>

                                            {/* Theme Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium text-foreground">{option.label}</h3>
                                                    {theme === option.id && (
                                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{option.description}</p>
                                            </div>

                                            {/* Selection Indicator */}
                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                theme === option.id
                                                    ? "border-primary bg-primary"
                                                    : "border-muted-foreground/30"
                                            )}>
                                                {theme === option.id && (
                                                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
        <div className="flex h-screen bg-background">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/30">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <NavLink to="/app">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </NavLink>
                        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
                    </div>
                    <NavLink to="/app">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </NavLink>
                </div>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/30">
                <div className="flex overflow-x-auto p-2 gap-2">
                    {sidebarItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200",
                                activeSection === item.id
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sidebar */}
            <div className="w-80 min-w-80 bg-background/50 backdrop-blur-sm border-r border-border/30 flex flex-col hidden md:flex">
                {/* Header */}
                <div className="p-6 border-b border-border/30">
                    <div className="flex items-center gap-3">
                        <NavLink to="/app">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </NavLink>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
                            <p className="text-sm text-muted-foreground">Customize your Subspace experience</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 p-4 space-y-2">
                    {sidebarItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={cn(
                                "w-full p-3 rounded-lg text-left transition-all duration-200 group",
                                activeSection === item.id
                                    ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                                    : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-md transition-colors",
                                    activeSection === item.id
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                                )}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="font-medium">{item.label}</div>
                                    <div className="text-xs opacity-70">{item.description}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/30">
                    <div className="text-xs text-muted-foreground/70 text-center">
                        Subspace Settings
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:mt-0 mt-32">
                {/* Content Header - Hidden on mobile */}
                <div className="hidden md:block p-6 border-b border-border/30 bg-background/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">
                                {sidebarItems.find(item => item.id === activeSection)?.label}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {sidebarItems.find(item => item.id === activeSection)?.description}
                            </p>
                        </div>
                        <NavLink to="/app">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </NavLink>
                    </div>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 max-w-4xl">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}