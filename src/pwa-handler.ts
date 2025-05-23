/**
 * Service worker registration handler
 * 
 * This ensures that our PWA always loads from network with no caching.
 */

// Register the service worker
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Unregister any existing service workers first
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }

            // Clear all caches
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));

            // Register new service worker with no caching
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: './',
                updateViaCache: 'none'
            });

            // Force immediate update
            await registration.update();

            // Add no-cache headers to all fetch requests
            navigator.serviceWorker.addEventListener('message', async (event) => {
                if (event.data && event.data.type === 'FETCH') {
                    const response = await fetch(event.data.url, {
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        }
                    });
                    event.ports[0].postMessage(response);
                }
            });

            console.log('Service Worker registered with no caching');
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    return null;
}

// Unregister all service workers and clear caches
export async function unregisterServiceWorkers() {
    if ('serviceWorker' in navigator) {
        // Unregister all service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }

        // Clear all caches
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));

        return true;
    }
    return false;
} 