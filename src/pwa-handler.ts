/**
 * Service worker registration and lifecycle handler
 * 
 * This ensures that our PWA works offline and that the offline detector
 * is displayed when internet connection is lost.
 */

// Register the service worker
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Register the service worker from the root
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: './' });

            console.log('Service Worker registered with scope:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker is installed but waiting to activate
                            console.log('New version available! Reload to update.');
                        }
                    });
                }
            });

            // Set up checks to see if the service worker is responding
            const TIMEOUT_MS = 3000; // 3 seconds timeout

            // Ping the service worker periodically
            setInterval(() => {
                const controller = navigator.serviceWorker.controller;

                if (controller) {
                    // Setup message timeout
                    const timeoutId = setTimeout(() => {
                        console.warn('Service Worker not responding. App may not work offline.');
                    }, TIMEOUT_MS);

                    // Send a ping message
                    const channel = new MessageChannel();
                    channel.port1.onmessage = () => {
                        clearTimeout(timeoutId);
                    };

                    controller.postMessage({ type: 'PING' }, [channel.port2]);
                }
            }, 60000); // Check every minute

            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    return null;
}

// Unregister all service workers
export async function unregisterServiceWorkers() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }
        return true;
    }
    return false;
}

// Force reload the page to activate a new service worker
export function forceReload() {
    window.location.reload();
} 