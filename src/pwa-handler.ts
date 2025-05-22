/**
 * Service worker registration handler
 * 
 * This ensures that our PWA is installable and caches static assets.
 */

// Register the service worker
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Register the service worker from the root
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: './',
                updateViaCache: 'none'
            });

            console.log('Service Worker registered with scope:', registration.scope);
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