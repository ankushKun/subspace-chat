// use pwa hook

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface UsePWAReturn {
    isInstallable: boolean;
    isInstalled: boolean;
    showInstallPrompt: () => Promise<void>;
    installPromptOutcome: 'accepted' | 'dismissed' | null;
    isStandalone: boolean;
}

export const usePWA = (): UsePWAReturn => {
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installPromptOutcome, setInstallPromptOutcome] = useState<'accepted' | 'dismissed' | null>(null);

    // Check if app is running in standalone mode (installed)
    const isStandalone = typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
    );

    useEffect(() => {
        // Check if already installed
        setIsInstalled(isStandalone);

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();

            const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
            setDeferredPrompt(beforeInstallPromptEvent);
            setIsInstallable(true);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
            console.log('PWA was installed');
        };

        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for the appinstalled event
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check if app is already installable (some browsers fire the event before listeners are added)
        if ('getInstalledRelatedApps' in navigator) {
            (navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
                if (relatedApps.length > 0) {
                    setIsInstalled(true);
                }
            }).catch(() => {
                // Ignore errors - this API is not widely supported
            });
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [isStandalone]);

    const showInstallPrompt = useCallback(async (): Promise<void> => {
        if (!deferredPrompt) {
            console.warn('Install prompt is not available');
            return;
        }

        try {
            // Show the install prompt
            await deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;

            setInstallPromptOutcome(outcome);

            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }

            // Clear the deferredPrompt so it can only be used once
            setDeferredPrompt(null);
            setIsInstallable(false);
        } catch (error) {
            console.error('Error showing install prompt:', error);
        }
    }, [deferredPrompt]);

    return {
        isInstallable,
        isInstalled,
        showInstallPrompt,
        installPromptOutcome,
        isStandalone,
    };
};

