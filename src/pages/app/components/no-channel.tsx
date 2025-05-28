import InboxComponent from "@/components/inbox"
import { AtSign, Hash, Users } from "lucide-react"

export default function NoChannel({ serverName }: { serverName?: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 relative overflow-hidden">
            <InboxComponent className="absolute top-4 right-4" />

            {/* Background decorative elements */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Floating orbs with improved positioning */}
                <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-gradient-to-br from-primary/8 to-primary/3 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-32 h-32 bg-gradient-to-tl from-primary/6 to-primary/2 rounded-full blur-2xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-gradient-to-bl from-primary/5 to-primary/1 rounded-full blur-xl animate-pulse delay-500" />
                <div className="absolute top-3/4 left-1/3 w-20 h-20 bg-gradient-to-tr from-primary/4 to-transparent rounded-full blur-2xl animate-pulse delay-1500" />

                {/* Enhanced grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_80%)]" />

                {/* Subtle radial gradient overlay */}
                <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/20" />
            </div>

            {/* Main content */}
            <div className="relative z-10 max-w-2xl mx-auto">
                {/* Icon container with enhanced styling */}
                <div className="relative mb-10 group">
                    <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/8 to-primary/3 flex items-center justify-center mx-auto border border-primary/8 shadow-2xl shadow-primary/10 group-hover:shadow-primary/20 transition-all duration-700 group-hover:scale-110 backdrop-blur-sm relative overflow-hidden">
                        {/* Background shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                        <Hash className="w-14 h-14 text-primary/80 group-hover:text-primary transition-all duration-500 relative z-10 drop-shadow-sm" />

                        {/* Animated rings with improved styling */}
                        <div className="absolute inset-0 rounded-3xl border border-primary/15 animate-pulse" />
                        <div className="absolute inset-1 rounded-2xl border border-primary/8 opacity-60" />
                        <div className="absolute inset-3 rounded-xl border border-primary/5 opacity-40" />
                    </div>

                    {/* Enhanced floating particles */}
                    <div className="absolute -top-3 -right-3 w-4 h-4 bg-gradient-to-br from-primary/60 to-primary/30 rounded-full animate-bounce delay-300 shadow-lg shadow-primary/20" />
                    <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-gradient-to-tl from-primary/50 to-primary/20 rounded-full animate-bounce delay-700 shadow-md shadow-primary/15" />
                    <div className="absolute top-1/2 -right-5 w-2 h-2 bg-gradient-to-bl from-primary/70 to-primary/40 rounded-full animate-bounce delay-1000 shadow-sm shadow-primary/10" />
                    <div className="absolute -top-1 left-1/4 w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce delay-1300" />
                </div>

                {/* Enhanced title with primary color */}
                <h1 className="text-5xl font-bold mb-6 text-foreground leading-tight tracking-tight">
                    {serverName ? (
                        <>
                            Welcome to <br />
                            <span className="text-primary">
                                {serverName}
                            </span>
                        </>
                    ) : (
                        <>
                            Welcome to <span className="text-primary">Subspace</span>
                        </>
                    )}
                </h1>

                {/* Enhanced subtitle */}
                <p className="text-xl text-muted-foreground/85 mb-10 leading-relaxed max-w-lg mx-auto font-light">
                    {serverName ? (
                        'Select a channel from the sidebar to start viewing and sending messages'
                    ) : (
                        'Connect with communities, join conversations, and share ideas in a decentralized space'
                    )}
                </p>

                {/* Enhanced action hints */}
                <div className="space-y-4">
                    {serverName ? (
                        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground/70 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 rounded-full px-8 py-4 border border-border/40 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <Hash className="w-5 h-5 text-primary/70" />
                            <span className="font-medium">Pick a channel to get started</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground/70 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 rounded-full px-8 py-4 border border-border/40 hover:bg-gradient-to-r hover:from-muted/40 hover:via-muted/30 hover:to-muted/40 transition-all duration-300 hover:scale-105 backdrop-blur-sm shadow-lg hover:shadow-xl cursor-pointer group">
                                <Users className="w-5 h-5 text-primary/70 group-hover:text-primary/90 transition-colors" />
                                <span className="font-medium">Join a server to connect with communities</span>
                            </div>
                            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground/70 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 rounded-full px-8 py-4 border border-border/40 hover:bg-gradient-to-r hover:from-muted/40 hover:via-muted/30 hover:to-muted/40 transition-all duration-300 hover:scale-105 backdrop-blur-sm shadow-lg hover:shadow-xl cursor-pointer group">
                                <AtSign className="w-5 h-5 text-primary/70 group-hover:text-primary/90 transition-colors" />
                                <span className="font-medium">Start a direct message conversation</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Enhanced decorative elements */}
                <div className="mt-16 flex items-center justify-center gap-3 opacity-40">
                    <div className="w-3 h-3 bg-gradient-to-br from-primary/60 to-primary/30 rounded-full animate-pulse shadow-sm" />
                    <div className="w-2 h-2 bg-gradient-to-br from-primary/50 to-primary/20 rounded-full animate-pulse delay-200 shadow-sm" />
                    <div className="w-1.5 h-1.5 bg-gradient-to-br from-primary/40 to-primary/15 rounded-full animate-pulse delay-400 shadow-sm" />
                    <div className="w-1 h-1 bg-primary/30 rounded-full animate-pulse delay-600" />
                </div>
            </div>

            {/* Enhanced bottom ambient glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-32 bg-gradient-to-t from-primary/8 via-primary/3 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-20 bg-gradient-to-t from-primary/5 to-transparent rounded-full blur-2xl" />
        </div>
    )
}