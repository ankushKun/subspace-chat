import { useEffect, useState, useCallback, useRef } from 'react';
import sLogo from '@/assets/s.png';
import BackgroundStars from './background-stars';

// Discord-like tips that appear when offline
const TIPS = [
    "Subspace runs entirely on Arweave and aoTheComputer",
    "You can use Subspace from any gateway like arweave.net, g8way.io, ar.io, and more",
    "You can install Subspace as an app from your browser",
    "Join the Subspace Discord to get help and stay updated",
];

// A key for storing offline tips in localStorage
const OFFLINE_TIP_KEY = 'subspace-offline-tip';

export function OfflineDetector({ children }: { children: React.ReactNode }) {
    // Get initial online state
    const [isOnline, setIsOnline] = useState(() => {
        // Always trust navigator.onLine for initial state
        return navigator.onLine;
    });

    // Show the loader if we're offline or if we're checking connectivity
    const [showLoader, setShowLoader] = useState(!navigator.onLine);

    // Get a random tip and save it to localStorage so it persists on refresh when offline
    const [tip] = useState(() => {
        // Try to get a saved tip from localStorage first
        const savedTip = localStorage.getItem(OFFLINE_TIP_KEY);
        if (savedTip) return savedTip;

        // Otherwise get a new random tip and save it
        const newTip = TIPS[Math.floor(Math.random() * TIPS.length)];
        try {
            localStorage.setItem(OFFLINE_TIP_KEY, newTip);
        } catch (e) {
            // Ignore errors if localStorage is not available
        }
        return newTip;
    });

    // Ref to track if component is mounted
    const isMounted = useRef(true);

    // Function to check connectivity by making a small HEAD request
    const checkConnectivity = useCallback(() => {
        if (!isMounted.current) return false;

        // Simply return the browser's navigator.onLine status
        return navigator.onLine;
    }, []);

    useEffect(() => {
        // Set mounted flag
        isMounted.current = true;

        let connectivityInterval: NodeJS.Timeout | null = null;

        const handleOnline = async () => {
            if (!isMounted.current) return;

            // Double-check with a real request
            const isReallyConnected = await checkConnectivity();
            setIsOnline(isReallyConnected);

            if (isReallyConnected) {
                // Add a slight delay before hiding the loader to ensure connection is stable
                setTimeout(() => {
                    if (isMounted.current) {
                        setShowLoader(false);
                    }
                }, 1000);

                // Choose a new tip for next time
                const newTip = TIPS[Math.floor(Math.random() * TIPS.length)];
                try {
                    localStorage.setItem(OFFLINE_TIP_KEY, newTip);
                } catch (e) {
                    // Ignore errors if localStorage is not available
                }
            }
        };

        const handleOffline = () => {
            if (!isMounted.current) return;

            setIsOnline(false);
            setShowLoader(true);
        };

        // Immediately check connectivity on mount
        const isConnected = checkConnectivity()
        if (!isMounted.current) return;

        setIsOnline(isConnected);
        setShowLoader(!isConnected);

        // Event listeners for connection status changes
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Periodically check connectivity when the page is shown as offline
        if (!isOnline || showLoader) {
            connectivityInterval = setInterval(async () => {
                if (!isMounted.current) return;

                const isConnected = await checkConnectivity();
                if (isConnected && !isOnline) {
                    setIsOnline(true);
                    setTimeout(() => {
                        if (isMounted.current) {
                            setShowLoader(false);
                        }
                    }, 1000);
                } else if (!isConnected && isOnline) {
                    setIsOnline(false);
                    setShowLoader(true);
                }
            }, 5000); // Check every 5 seconds
        }

        return () => {
            isMounted.current = false;
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (connectivityInterval) clearInterval(connectivityInterval);
        };
    }, [isOnline, showLoader, checkConnectivity]);

    if (showLoader) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-all duration-300 ease-in-out">
                <BackgroundStars />
                <div className="flex flex-col items-center max-w-md px-4">
                    <div className="relative mb-8">
                        <img
                            src={sLogo}
                            alt="Subspace"
                            className="w-20 h-20"
                        />
                        <div className="absolute -inset-4 border-t-2 border-gray-600 rounded-full animate-spin"
                            style={{ borderTopColor: 'rgba(160, 160, 220, 0.8)', animationDuration: '1.2s' }}>
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h3 className="text-xl font-semibold text-white mb-2">
                            {isOnline ? "Reconnecting..." : "No Internet Connection"}
                        </h3>
                        <p className="text-gray-400">
                            {isOnline
                                ? "We're trying to reconnect you"
                                : "Check your internet connection and try again"}
                        </p>
                    </div>

                    {!isOnline && (
                        <div className="bg-gray-900 p-4 rounded-md border border-gray-800 mb-6 max-w-sm">
                            <p className="text-gray-500 text-sm font-medium mb-2">DID YOU KNOW</p>
                            <p className="text-gray-300">{tip}</p>
                        </div>
                    )}

                    <div className="flex space-x-2 mt-2">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="w-2.5 h-2.5 rounded-full bg-gray-600 animate-pulse"
                                style={{ animationDelay: `${i * 0.25}s` }}
                            />
                        ))}
                    </div>
                </div>
                {/* @ts-ignore */}
                <div className="text-muted-foreground/50 mt-6 font-mono text-xs">v{__APP_VERSION__}</div>
            </div>
        );
    }

    return <>{children}</>;
} 