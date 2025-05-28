import { useEffect, useRef, useState, useCallback } from 'react';

interface SoundManager {
    playNotification: () => void;
    showBrowserNotification: (title: string, body: string, options?: { icon?: string; serverId?: string; channelId?: number }) => void;
    isLoaded: boolean;
    isEnabled: boolean;
    setEnabled: (enabled: boolean) => void;
    browserNotificationsEnabled: boolean;
    setBrowserNotificationsEnabled: (enabled: boolean) => void;
    requestNotificationPermission: () => Promise<boolean>;
    notificationPermission: NotificationPermission;
}

export const useSound = (): SoundManager => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isEnabled, setIsEnabled] = useState(() => {
        // Get sound preference from localStorage, default to true
        const saved = localStorage.getItem('notification-sound-enabled');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [browserNotificationsEnabled, setBrowserNotificationsEnabledState] = useState(() => {
        // Get browser notification preference from localStorage, default to true
        const saved = localStorage.getItem('browser-notifications-enabled');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
    );

    useEffect(() => {
        // Preload and cache the notification sound
        const audio = new Audio('/notification.wav');

        // Set audio properties for better performance
        audio.preload = 'auto';
        audio.volume = 1; // Set a reasonable default volume

        const handleCanPlayThrough = () => {
            setIsLoaded(true);
            console.log('Notification sound loaded and cached');
        };

        const handleError = (error: Event) => {
            console.error('Failed to load notification sound:', error);
            setIsLoaded(false);
        };

        audio.addEventListener('canplaythrough', handleCanPlayThrough);
        audio.addEventListener('error', handleError);

        audioRef.current = audio;

        // Cleanup
        return () => {
            audio.removeEventListener('canplaythrough', handleCanPlayThrough);
            audio.removeEventListener('error', handleError);
            audioRef.current = null;
        };
    }, []);

    // Save sound preference to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('notification-sound-enabled', JSON.stringify(isEnabled));
    }, [isEnabled]);

    // Save browser notification preference to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('browser-notifications-enabled', JSON.stringify(browserNotificationsEnabled));
    }, [browserNotificationsEnabled]);

    // Check notification permission on mount and when it might change
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    const playNotification = useCallback(() => {
        if (!isEnabled || !audioRef.current || !isLoaded) {
            return;
        }

        try {
            // Reset audio to beginning in case it was played recently
            audioRef.current.currentTime = 0;

            // Play the sound
            const playPromise = audioRef.current.play();

            // Handle play promise (required for some browsers)
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Failed to play notification sound:', error);
                });
            }
        } catch (error) {
            console.warn('Error playing notification sound:', error);
        }
    }, [isEnabled, isLoaded]);

    const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            console.warn('Browser notifications not supported');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission === 'denied') {
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }, []);

    const showBrowserNotification = useCallback((title: string, body: string, options?: { icon?: string; serverId?: string; channelId?: number }) => {
        if (!browserNotificationsEnabled ||
            typeof window === 'undefined' ||
            !('Notification' in window) ||
            Notification.permission !== 'granted') {
            return;
        }

        try {
            const notification = new Notification(title, {
                body,
                icon: options?.icon || '/icon-192.png',
                badge: '/icon-192.png',
                // tag: 'subspace-mention', // This will replace previous notifications
                requireInteraction: false, // Keep notification until user interacts
                silent: false, // Let the sound hook handle audio
            });

            // Handle notification click - navigate to server and channel, then close
            notification.onclick = () => {
                window.focus();

                // Navigate to the server and channel if provided
                if (options?.serverId && options?.channelId) {
                    // Dispatch a custom event that the React app can listen to
                    const navigationEvent = new CustomEvent('subspace-notification-navigate', {
                        detail: {
                            serverId: options.serverId,
                            channelId: options.channelId
                        }
                    });
                    window.dispatchEvent(navigationEvent);
                }

                notification.close();
            };
        } catch (error) {
            console.warn('Error showing browser notification:', error);
        }
    }, [browserNotificationsEnabled]);

    const setEnabled = useCallback((enabled: boolean) => {
        setIsEnabled(enabled);
    }, []);

    const setBrowserNotificationsEnabled = useCallback((enabled: boolean) => {
        setBrowserNotificationsEnabledState(enabled);
    }, []);

    return {
        playNotification,
        showBrowserNotification,
        isLoaded,
        isEnabled,
        setEnabled,
        browserNotificationsEnabled,
        setBrowserNotificationsEnabled,
        requestNotificationPermission,
        notificationPermission
    };
}; 