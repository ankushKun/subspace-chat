/**
 * Service worker registration handler
 * 
 * This ensures that our PWA is installable and caches static assets.
 * Always fetches the latest version from the server.
 */

// Register the service worker
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Force update existing service worker if it exists
            const existingRegistration = await navigator.serviceWorker.getRegistration();
            if (existingRegistration) {
                await existingRegistration.update();
            }

            // Register the service worker from the root with no caching
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: './',
                updateViaCache: 'none'
            });

            // Immediately check for updates
            registration.addEventListener('activate', () => {
                registration.update();
            });

            // Check for updates every 5 minutes
            setInterval(() => {
                registration.update();
            }, 5 * 60 * 1000);

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