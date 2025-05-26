/**
 * Service worker registration handler
 * 
 * This ensures that our PWA loads dynamic content from network while maintaining installability.
 */

// Register the service worker
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Clear all caches except PWA essentials
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== 'pwa-essential')
                    .map(cacheName => caches.delete(cacheName))
            );

            // Register new service worker with no caching
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: './',
                updateViaCache: 'none'
            });

            // Force immediate update
            await registration.update();

            // Add no-cache headers to all fetch requests except PWA essentials
            navigator.serviceWorker.addEventListener('message', async (event) => {
                if (event.data && event.data.type === 'FETCH') {
                    const url = new URL(event.data.url);
                    const isPWAEssential = /(manifest\.webmanifest|s\.png|stars\.gif)$/.test(url.pathname);

                    const response = await fetch(event.data.url, {
                        headers: isPWAEssential ? {} : {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        }
                    });
                    event.ports[0].postMessage(response);
                }
            });

            console.log('Service Worker registered with minimal caching for PWA installation');
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    return null;
}

// Unregister service workers and clear non-essential caches
export async function unregisterServiceWorkers() {
    if ('serviceWorker' in navigator) {
        // Unregister all service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }

        // Clear all caches except PWA essentials
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter(cacheName => cacheName !== 'pwa-essential')
                .map(cacheName => caches.delete(cacheName))
        );

        return true;
    }
    return false;
} 