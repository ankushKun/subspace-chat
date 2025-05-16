import React, { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function NotificationSettings() {
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
        typeof localStorage !== 'undefined' ? localStorage.getItem('notifications-enabled') !== 'false' : true
    );
    const [notificationsSupported, setNotificationsSupported] = useState<boolean>(false);
    const [notificationPermission, setNotificationPermission] = useState<string>('default');

    useEffect(() => {
        // Check if notifications are supported
        const supported = 'Notification' in window;
        setNotificationsSupported(supported);

        if (supported) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    const handleToggleNotifications = (checked: boolean) => {
        if (checked && notificationPermission !== 'granted') {
            Notification.requestPermission().then((permission) => {
                setNotificationPermission(permission);
                if (permission === 'granted') {
                    localStorage.setItem('notifications-enabled', 'true');
                    setNotificationsEnabled(true);
                    toast.success('Notifications enabled');
                } else {
                    localStorage.setItem('notifications-enabled', 'false');
                    setNotificationsEnabled(false);
                    toast.error('Notification permission denied');
                }
            });
        } else {
            localStorage.setItem('notifications-enabled', checked ? 'true' : 'false');
            setNotificationsEnabled(checked);
            toast.success(checked ? 'Notifications enabled' : 'Notifications disabled');
        }
    };

    const requestPermission = () => {
        Notification.requestPermission().then((permission) => {
            setNotificationPermission(permission);
            if (permission === 'granted') {
                localStorage.setItem('notifications-enabled', 'true');
                setNotificationsEnabled(true);
                toast.success('Notification permission granted');
            } else {
                toast.error('Notification permission denied');
            }
        });
    };

    // If notifications are not supported in this browser
    if (!notificationsSupported) {
        return (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700">
                    Notifications are not supported in this browser.
                </p>
            </div>
        );
    }

    // If permission is denied
    if (notificationPermission === 'denied') {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700 mb-2">
                    Notification permission is blocked. You need to allow notifications in your browser settings.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <Switch
                    id="notifications"
                    checked={notificationsEnabled}
                    onCheckedChange={handleToggleNotifications}
                    disabled={notificationPermission === 'denied'}
                />
                <Label htmlFor="notifications">Enable message notifications</Label>
            </div>

            {notificationPermission === 'default' && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={requestPermission}
                    className="mt-2"
                >
                    Allow Notifications
                </Button>
            )}

            <div className="text-xs text-gray-500 mt-2">
                {notificationsEnabled ?
                    'You will receive notifications for new messages.' :
                    'You will not receive notifications for new messages.'}
            </div>
        </div>
    );
} 