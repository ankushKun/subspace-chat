import { useWallet } from "@/hooks/use-wallet";
import { Bot, Settings, ExternalLink, Users, Globe, Plus, MoreHorizontal, ArrowLeft } from "lucide-react";
import LoginDialog from "@/components/login-dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Link } from "react-router";

type BotApp = {
    id: string;
    name: string;
    description?: string;
    avatar?: string;
    serverCount: number;
    isPublic: boolean;
    createdAt: Date;
}

function BotAppCard({ bot }: { bot: BotApp }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="group relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={cn(
                "relative p-6 rounded-xl border border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 overflow-hidden cursor-pointer",
                "hover:bg-background/90 hover:border-border hover:shadow-lg hover:shadow-primary/10",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
            )}>
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.02)_0%,transparent_50%)] pointer-events-none" />

                {/* Header with bot image and basic info */}
                <div className="flex items-start gap-4 mb-4 relative z-10">
                    <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                            {bot.avatar ? (
                                <img
                                    src={`https://arweave.net/${bot.avatar}`}
                                    alt={bot.name}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                />
                            ) : (
                                <Bot className="w-8 h-8 text-primary/80" />
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {bot.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {bot.isPublic && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Globe className="w-3 h-3" />
                                            <span>Public</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50"
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem className="flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        Manage Bot
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="flex items-center gap-2">
                                        <ExternalLink className="w-4 h-4" />
                                        View Public Page
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="flex items-center gap-2 text-destructive">
                                        <Bot className="w-4 h-4" />
                                        Delete Bot
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* Description */}
                {bot.description && (
                    <p className="text-sm text-muted-foreground/80 mb-4 line-clamp-2 relative z-10">
                        {bot.description}
                    </p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                                <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    {bot.serverCount}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    server{bot.serverCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                            Created {bot.createdAt.toLocaleDateString()}
                        </p>
                    </div>
                </div>

                {/* Shimmer effect on hover */}
                {isHovered && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                )}
            </div>
        </div>
    );
}

function CreateBotCard() {
    return (
        <div className="group relative">
            <div className={cn(
                "relative p-6 rounded-xl border-2 border-dashed border-border/50 bg-background/40 backdrop-blur-sm transition-all duration-300 overflow-hidden cursor-pointer h-full",
                "hover:bg-background/60 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
            )}>
                <div className="flex flex-col items-center justify-center text-center h-full min-h-[200px] relative z-10">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <Plus className="w-8 h-8 text-primary/80" />
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                        Create New Bot
                    </h3>

                    <p className="text-sm text-muted-foreground/80 mb-4 max-w-xs">
                        Start building your next bot application on the Subspace platform
                    </p>

                    <Button
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    >
                        Get Started
                    </Button>
                </div>
            </div>
        </div>
    );
}

function NotLoggedIn() {
    return (
        <div className="flex flex-col items-center justify-center h-svh text-center p-8 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Floating orbs with developer theme colors */}
                <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-gradient-to-br from-blue-500/8 to-purple-500/3 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-32 h-32 bg-gradient-to-tl from-primary/6 to-blue-500/2 rounded-full blur-2xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-primary/1 rounded-full blur-xl animate-pulse delay-500" />
                <div className="absolute top-3/4 left-1/3 w-20 h-20 bg-gradient-to-tr from-blue-500/4 to-transparent rounded-full blur-2xl animate-pulse delay-1500" />

                {/* Enhanced grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_80%)]" />

                {/* Subtle radial gradient overlay */}
                <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/20" />
            </div>

            {/* Main content */}
            <div className="relative z-10 max-w-2xl mx-auto animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                {/* Icon container with developer theming */}
                <div className="relative mb-10 group">
                    <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-blue-500/15 via-primary/8 to-purple-500/5 flex items-center justify-center mx-auto border border-primary/8 shadow-2xl shadow-blue-500/10 group-hover:shadow-primary/20 transition-all duration-700 group-hover:scale-110 backdrop-blur-sm relative overflow-hidden">
                        {/* Background shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                        <Bot className="w-14 h-14 text-primary/80 group-hover:text-primary transition-all duration-500 relative z-10 drop-shadow-sm" />

                        {/* Animated rings */}
                        <div className="absolute inset-0 rounded-3xl border border-blue-500/15 animate-pulse" />
                        <div className="absolute inset-1 rounded-2xl border border-primary/8 opacity-60" />
                        <div className="absolute inset-3 rounded-xl border border-purple-500/5 opacity-40" />
                    </div>

                    {/* Enhanced floating particles with dev theme */}
                    <div className="absolute -top-3 -right-3 w-4 h-4 bg-gradient-to-br from-blue-500/60 to-primary/30 rounded-full animate-bounce delay-300 shadow-lg shadow-blue-500/20" />
                    <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-gradient-to-tl from-purple-500/50 to-primary/20 rounded-full animate-bounce delay-700 shadow-md shadow-purple-500/15" />
                    <div className="absolute top-1/2 -right-5 w-2 h-2 bg-gradient-to-bl from-primary/70 to-blue-500/40 rounded-full animate-bounce delay-1000 shadow-sm shadow-primary/10" />
                    <div className="absolute -top-1 left-1/4 w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce delay-1300" />
                </div>

                {/* Enhanced title with developer theme */}
                <h1 className="text-5xl font-bold mb-6 text-foreground leading-tight tracking-tight">
                    Bot <br />
                    <span className="text-primary bg-gradient-to-r from-primary to-blue-500 bg-clip-text">
                        Applications
                    </span>
                </h1>

                {/* Enhanced subtitle */}
                <p className="text-xl text-muted-foreground/85 mb-10 leading-relaxed max-w-lg mx-auto font-light">
                    Manage your bot applications on Subspace. Connect your wallet to access your bots and create new ones.
                </p>

                {/* Login button */}
                <div className="mb-10">
                    <LoginDialog>
                        <Button
                            size="lg"
                            className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                        >
                            <Bot className="w-5 h-5 mr-3" />
                            Connect Wallet
                        </Button>
                    </LoginDialog>
                </div>

                {/* Enhanced action hints */}
                <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground/70 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 rounded-full px-8 py-4 border border-border/40 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                        <Bot className="w-5 h-5 text-blue-500/70" />
                        <span className="font-medium">Create and manage your bot applications</span>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground/70 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 rounded-full px-8 py-4 border border-border/40 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                        <Settings className="w-5 h-5 text-primary/70" />
                        <span className="font-medium">Deploy bots to servers across the network</span>
                    </div>
                </div>

                {/* Enhanced decorative elements */}
                <div className="mt-16 flex items-center justify-center gap-3 opacity-40">
                    <div className="w-3 h-3 bg-gradient-to-br from-blue-500/60 to-primary/30 rounded-full animate-pulse shadow-sm" />
                    <div className="w-2 h-2 bg-gradient-to-br from-primary/50 to-purple-500/20 rounded-full animate-pulse delay-200 shadow-sm" />
                    <div className="w-1.5 h-1.5 bg-gradient-to-br from-purple-500/40 to-primary/15 rounded-full animate-pulse delay-400 shadow-sm" />
                    <div className="w-1 h-1 bg-blue-500/30 rounded-full animate-pulse delay-600" />
                </div>
            </div>

            {/* Enhanced bottom ambient glow with dev theme */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-32 bg-gradient-to-t from-blue-500/8 via-primary/3 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-20 bg-gradient-to-t from-primary/5 to-transparent rounded-full blur-2xl" />
        </div>
    );
}

export default function DeveloperBots() {
    const { connected } = useWallet()

    // Mock data - replace with real data from your state management
    const mockBots: BotApp[] = [
        {
            id: "1",
            name: "ChatBot Pro",
            description: "An advanced chatbot for community engagement and moderation with AI-powered responses",
            serverCount: 23,
            isPublic: true,
            createdAt: new Date('2024-01-15')
        },
        {
            id: "2",
            name: "Moderation Assistant",
            description: "Automated moderation tools to keep your server safe and friendly",
            serverCount: 8,
            isPublic: false,
            createdAt: new Date('2024-02-10')
        },
        {
            id: "3",
            name: "Analytics Bot",
            serverCount: 15,
            isPublic: true,
            createdAt: new Date('2024-03-01')
        }
    ];

    if (!connected) {
        return <NotLoggedIn />;
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* Background decorative elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-gradient-to-br from-primary/5 to-primary/2 rounded-full blur-2xl" />
                <div className="absolute bottom-1/3 left-1/4 w-24 h-24 bg-gradient-to-tl from-blue-500/3 to-primary/1 rounded-full blur-xl" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_70%)]" />
            </div>

            <div className="relative z-10 p-6">
                {/* Header with back button */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-3">
                        <Link to="/developer">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 hover:bg-muted/50 rounded-xl"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                                <Bot className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">
                                    Bot Applications
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Manage and deploy your bot applications
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>

                {/* Bot cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mockBots.map((bot) => (
                        <BotAppCard key={bot.id} bot={bot} />
                    ))}
                    <CreateBotCard />
                </div>

                {/* Empty state when no bots */}
                {mockBots.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center mb-6 border border-border/50">
                            <Bot className="w-10 h-10 text-muted-foreground/60" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                            No bot applications yet
                        </h3>
                        <p className="text-muted-foreground mb-6 max-w-md">
                            Create your first bot application to start building on the Subspace platform
                        </p>
                        <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Your First Bot
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
} 