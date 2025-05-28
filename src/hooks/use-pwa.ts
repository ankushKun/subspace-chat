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
    debugInfo: {
        hasServiceWorker: boolean;
        hasManifest: boolean;
        isSecure: boolean;
        userAgent: string;
        deferredPromptAvailable: boolean;
    };
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

    // Debug information
    const debugInfo = {
        hasServiceWorker: 'serviceWorker' in navigator,
        hasManifest: typeof document !== 'undefined' && !!document.querySelector('link[rel="manifest"]'),
        isSecure: typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost'),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        deferredPromptAvailable: !!deferredPrompt
    };

    useEffect(() => {
        // Log debug information
        console.log('PWA Debug Info:', debugInfo);

        // Check if already installed
        setIsInstalled(isStandalone);
        console.log('PWA isStandalone:', isStandalone);

        const handleBeforeInstallPrompt = (e: Event) => {
            console.log('beforeinstallprompt event fired:', e);

            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();

            const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
            console.log('beforeinstallprompt platforms:', beforeInstallPromptEvent.platforms);

            setDeferredPrompt(beforeInstallPromptEvent);
            setIsInstallable(true);

            console.log('PWA install prompt is now available');
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
                console.log('getInstalledRelatedApps result:', relatedApps);
                if (relatedApps.length > 0) {
                    setIsInstalled(true);
                }
            }).catch((error: any) => {
                console.log('getInstalledRelatedApps error (this is normal):', error);
                // Ignore errors - this API is not widely supported
            });
        }

        // Additional PWA criteria checks
        const checkPWACriteria = async () => {
            console.log('Checking PWA installation criteria...');

            // Check service worker
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    console.log('Service Worker registration:', registration);
                } catch (error) {
                    console.error('Service Worker check failed:', error);
                }
            }

            // Check manifest
            const manifestLink = document.querySelector('link[rel="manifest"]');
            console.log('Manifest link found:', !!manifestLink);
            if (manifestLink) {
                console.log('Manifest href:', (manifestLink as HTMLLinkElement).href);

                // Try to fetch and validate manifest
                try {
                    const response = await fetch((manifestLink as HTMLLinkElement).href);
                    const manifest = await response.json();
                    console.log('Manifest content:', manifest);

                    // Check required manifest fields
                    const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
                    const missingFields = requiredFields.filter(field => !manifest[field]);
                    if (missingFields.length > 0) {
                        console.warn('Manifest missing required fields:', missingFields);
                    }

                    // Check icons
                    if (manifest.icons && manifest.icons.length > 0) {
                        console.log('Manifest icons:', manifest.icons);
                        const hasRequiredSizes = manifest.icons.some((icon: any) =>
                            icon.sizes && (icon.sizes.includes('192x192') || icon.sizes.includes('512x512'))
                        );
                        console.log('Has required icon sizes (192x192 or 512x512):', hasRequiredSizes);
                    }
                } catch (error) {
                    console.error('Failed to fetch or parse manifest:', error);
                }
            }

            // Check HTTPS
            console.log('Is secure context:', window.isSecureContext);
            console.log('Protocol:', window.location.protocol);
        };

        checkPWACriteria();

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [isStandalone]);

    const showInstallPrompt = useCallback(async (): Promise<void> => {
        console.log('showInstallPrompt called, deferredPrompt available:', !!deferredPrompt);

        if (!deferredPrompt) {
            console.warn('Install prompt is not available. Possible reasons:');
            console.warn('1. App is already installed');
            console.warn('2. Browser does not support PWA installation');
            console.warn('3. PWA criteria not met (manifest, service worker, HTTPS)');
            console.warn('4. beforeinstallprompt event has not fired yet');
            console.warn('5. User has previously dismissed the prompt');
            console.warn('Debug info:', debugInfo);
            return;
        }

        try {
            console.log('Showing install prompt...');

            // Show the install prompt
            await deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;

            console.log('User choice outcome:', outcome);
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
    }, [deferredPrompt, debugInfo]);

    return {
        isInstallable,
        isInstalled,
        showInstallPrompt,
        installPromptOutcome,
        isStandalone,
        debugInfo,
    };
};

