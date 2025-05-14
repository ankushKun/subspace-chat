import { Mic, Headphones, Settings } from 'lucide-react'
import { useActiveAddress } from '@arweave-wallet-kit/react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Profile() {
    const activeAddress = useActiveAddress();

    return (
        <div className="mt-auto w-full border-t border-border/30 p-2 bg-background/50 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/40 transition-colors cursor-pointer">
                {/* User avatar */}
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center">
                        {activeAddress ? (
                            <span className="text-xs font-medium">{activeAddress.substring(0, 2)}</span>
                        ) : (
                            <span className="text-xs">?</span>
                        )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background"></div>
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                        {activeAddress ?
                            `${activeAddress.substring(0, 6)}...${activeAddress.substring(activeAddress.length - 4)}`
                            : 'Not Connected'}
                    </div>
                    <div className="flex flex-col">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span>Online</span>
                        </div>
                        {/* <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <svg viewBox="0 0 24 24" className="w-3 h-3 mr-0.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.5 12C17.5 13.576 16.8415 14.9977 15.7746 16C14.7077 17.0023 13.2389 17.625 11.5834 17.625C9.92789 17.625 8.45435 17.0047 7.38296 16.0047C6.31158 15.0047 5.66667 13.5767 5.66667 12C5.66667 10.4233 6.31158 8.9953 7.38296 7.9953C8.45435 6.9953 9.92789 6.375 11.5834 6.375C13.2389 6.375 14.7134 6.9953 15.7769 7.9953C16.8403 8.9953 17.5 10.424 17.5 12Z" fill="currentColor"></path>
                                <path d="M21.25 11.6137C21.25 9.57811 20.3984 7.625 18.8659 6.16819C17.3335 4.71137 15.2671 3.90625 13.125 3.90625H5.78125L2.75 6.85228L5.78125 9.79831H7.94956C7.81603 10.3386 7.75 10.9018 7.75 11.4741V11.6137C7.75 14.1895 9.90956 16.25 12.5991 16.25H21.25V11.6137Z" fill="currentColor"></path>
                            </svg>
                            <span>Playing Code</span>
                        </div> */}
                    </div>
                </div>

                {/* Control buttons */}
                <div className="flex items-center gap-1">
                    {/* <button className="w-8 h-8 rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Microphone">
                        <Mic className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Headphones">
                        <Headphones className="w-4 h-4" />
                    </button> */}
                    <Link to="/app/settings">
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Settings">
                            <Settings className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}