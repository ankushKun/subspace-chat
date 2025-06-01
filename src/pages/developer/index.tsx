import { useWallet } from "@/hooks/use-wallet";
import { Code2, Bot, Database, Cpu, Zap, Terminal, ExternalLink, ArrowRight, Globe, Users, Shield, Sparkles } from "lucide-react";
import LoginDialog from "@/components/login-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { Link, useNavigate } from "react-router";
import { useEffect, useRef } from "react";

export default function DeveloperLanding() {
    const { connected } = useWallet();
    const navigate = useNavigate();
    const wasConnectedOnMount = useRef(connected);

    // Redirect to /developer/bots when user authenticates on this page
    useEffect(() => {
        if (!wasConnectedOnMount.current && connected) {
            navigate("/developer/bots");
        }
    }, [connected, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden">
            <title>Subspace Developer Portal</title>

            {/* Header Actions */}
            {connected ? (
                <Link to="/developer/bots">
                    <Button className="absolute top-8 right-6 z-20 font-bold">
                        Developer Portal <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                </Link>
            ) : (
                <LoginDialog>
                    <Button className="absolute top-6 right-6 z-20 font-bold">
                        Login
                    </Button>
                </LoginDialog>
            )}

            <ThemeToggleButton className="absolute top-4 left-4 z-20" />

            {/* Background decorative elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-primary/5 to-blue-500/2 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-gradient-to-tl from-purple-500/4 to-primary/2 rounded-full blur-2xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-gradient-to-bl from-blue-500/3 to-transparent rounded-full blur-xl animate-pulse delay-500" />

                {/* Grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
            </div>

            {/* Hero Section */}
            <div className="h-screen relative flex flex-col items-center justify-center text-center px-6">
                <div className="font-ka text-4xl sm:text-6xl md:text-7xl tracking-wider drop-shadow-2xl drop-shadow-primary/40 mb-4">
                    SUBSPACE
                </div>
                <div className="font-vipnagorgialla tracking-wider text-base sm:text-lg md:text-2xl scale-y-130 mb-6 drop-shadow-xl">
                    Developer Platform
                </div>
                <div className="text-lg sm:text-xl md:text-2xl text-muted-foreground/80 mb-8 max-w-3xl leading-relaxed">
                    Build the future of decentralized communication with powerful APIs,
                    bot frameworks, and permaweb infrastructure.
                </div>

                {/* Quick stats */}
                <div className="flex flex-wrap gap-6 mb-12 justify-center">
                    <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Decentralized</span>
                    </div>
                    <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Permissionless</span>
                    </div>
                    <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Powered by AO</span>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="w-full max-w-7xl mx-auto px-6 py-16 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 font-ka tracking-wide">
                        What You Can Build
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Subspace provides everything you need to create next-generation communication applications
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 mb-16">
                    {/* Bot Applications */}
                    <div className="group relative">
                        <div className="relative p-8 rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 overflow-hidden hover:bg-background/90 hover:border-border hover:shadow-xl hover:shadow-primary/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                                    <Bot className="w-8 h-8 text-primary" />
                                </div>

                                <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                                    Self running Bots
                                </h3>
                                <p className="text-muted-foreground/80 mb-4 leading-relaxed">
                                    Create intelligent bots for moderation, engagement, and automation across the Subspace network.
                                </p>
                                <div className="flex items-center gap-2 text-primary font-medium">
                                    <span>Explore Bots</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AO Compute */}
                    <div className="group relative">
                        <div className="relative p-8 rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 overflow-hidden hover:bg-background/90 hover:border-border hover:shadow-xl hover:shadow-green-500/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center mb-6 border border-green-500/20 group-hover:scale-110 transition-transform duration-300">
                                    <Cpu className="w-8 h-8 text-green-500" />
                                </div>

                                <h3 className="text-xl font-semibold mb-3 group-hover:text-green-500 transition-colors">
                                    AO Compute
                                </h3>
                                <p className="text-muted-foreground/80 mb-4 leading-relaxed">
                                    Leverage AO's decentralized compute for serverless functions and smart contract integration.
                                </p>
                                <div className="flex items-center gap-2 text-green-500 font-medium">
                                    <span>Learn AO</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SDK & Tools */}
                    <div className="group relative">
                        <div className="relative p-8 rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 overflow-hidden hover:bg-background/90 hover:border-border hover:shadow-xl hover:shadow-orange-500/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-500/10 flex items-center justify-center mb-6 border border-orange-500/20 group-hover:scale-110 transition-transform duration-300">
                                    <Terminal className="w-8 h-8 text-orange-500" />
                                </div>

                                <h3 className="text-xl font-semibold mb-3 group-hover:text-orange-500 transition-colors">
                                    SDK & Tools
                                </h3>
                                <p className="text-muted-foreground/80 mb-4 leading-relaxed">
                                    Developer SDKs, CLI tools, and frameworks to accelerate your Subspace development.
                                </p>
                                <div className="flex items-center gap-2 text-orange-500 font-medium">
                                    <span>Get Started</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Community Support */}
                    <div className="group relative">
                        <div className="relative p-8 rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 overflow-hidden hover:bg-background/90 hover:border-border hover:shadow-xl hover:shadow-pink-500/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-500/10 flex items-center justify-center mb-6 border border-pink-500/20 group-hover:scale-110 transition-transform duration-300">
                                    <Users className="w-8 h-8 text-pink-500" />
                                </div>

                                <h3 className="text-xl font-semibold mb-3 group-hover:text-pink-500 transition-colors">
                                    Community
                                </h3>
                                <p className="text-muted-foreground/80 mb-4 leading-relaxed">
                                    Join our developer community for support, collaboration, and the latest updates.
                                </p>
                                <div className="flex items-center gap-2 text-pink-500 font-medium">
                                    <span>Join Discord</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="text-center text-muted-foreground/80 text-sm">
                    and more...
                </div>
            </div>

            {/* CTA Section */}
            <div className="flex flex-col items-center justify-center gap-8 my-24 pb-16 px-6">
                <div className="text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 font-ka tracking-wide">
                        Ready to Build?
                    </h2>
                    <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
                        Start developing on Subspace today and become part of the decentralized communication revolution.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    {(() => {
                        const StartBtn = (
                            <Button className="z-20 p-8 px-12 drop-shadow-2xl tracking-wider bg-primary text-primary-foreground hover:bg-primary-foreground font-ka text-xl md:text-2xl hover:text-primary transform hover:scale-110 transition duration-500">
                                <Zap className="w-6 h-6 mr-3" />
                                Start Building
                            </Button>
                        );

                        const DocsBtn = (
                            <Button variant="outline" className="z-20 p-8 px-12 drop-shadow-2xl tracking-wider font-ka text-xl md:text-2xl transform hover:scale-110 transition duration-500">
                                <Code2 className="w-6 h-6 mr-3" />
                                View Docs
                            </Button>
                        );

                        return connected ? (
                            <>
                                <Link to="/developer/bots">{StartBtn}</Link>
                                {DocsBtn}
                            </>
                        ) : (
                            <>
                                <LoginDialog>{StartBtn}</LoginDialog>
                                {DocsBtn}
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col bg-primary w-full p-6 gap-4">
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="font-ka tracking-widest">
                        powered by <Link target="_blank" to="https://x.com/aoTheComputer" className="hover:underline underline-offset-8 hover:text-white">aoTheComputer</Link>
                    </div>
                </div>
                {/* @ts-ignore */}
                <div className="text-xs text-white/60 font-vipnagorgialla text-left md:text-center">v{__VERSION__}</div>
            </div>
        </div>
    );
}