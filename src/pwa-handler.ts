/**
 * Service worker registration and lifecycle handler
 * 
 * This ensures that our PWA works offline and that the offline detector
 * is displayed when internet connection is lost.
 */

// Flag to prevent reload loops
let didReloadOnce = false;
// Flag to control update frequency
const UPDATE_COOLDOWN = 1000 * 60 * 60; // 1 hour
let lastUpdateTime = 0;

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

            // Check for updates on a schedule
            setInterval(() => {
                const now = Date.now();
                // Only check if it's been long enough since last update
                if (now - lastUpdateTime > UPDATE_COOLDOWN) {
                    registration.update().catch(err => {
                        console.error('Failed to check for SW updates:', err);
                    });
                    lastUpdateTime = now;
                }
            }, 60 * 60 * 1000); // Check every hour

            // Silent update process
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                if (newWorker) {
                    console.log('New service worker is installing silently...');

                    newWorker.addEventListener('statechange', () => {
                        // Just log the state change, no UI updates
                        console.log(`Service worker state changed to: ${newWorker.state}`);
                        // Completely silent - no events dispatched
                    });
                }
            });

            // Handle controllerchange with reload protection
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('New service worker controller activated silently.');

                // Prevent infinite reload loops
                if (!didReloadOnce) {
                    didReloadOnce = true;

                    // Store the flag in sessionStorage as another layer of protection
                    // against reload loops in case a variable reset happens
                    if (!sessionStorage.getItem('sw_updated_this_session')) {
                        sessionStorage.setItem('sw_updated_this_session', 'true');

                        // Silent reload without any UI indication
                        setTimeout(() => {
                            console.log('Silently applying update with page reload');
                            window.location.reload();
                        }, 1000);
                    } else {
                        console.log('Already updated this session, preventing reload loop');
                    }
                } else {
                    console.log('Prevented a second reload');
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
    // Reset update flags
    didReloadOnce = false;
    sessionStorage.removeItem('sw_updated_this_session');

    // Clear application cache before reloading
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
            });
        });
    }
    window.location.reload();
} 