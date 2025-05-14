import { useState, useEffect } from 'react';

/**
 * Hook to detect if the app is being viewed on a mobile device
 * based on screen width.
 * 
 * @param breakpoint The width threshold to consider as mobile (default: 768px)
 * @returns Boolean indicating if the current view is mobile
 */
export function useMobile(breakpoint: number = 768) {
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        // Set initial value on mount
        setIsMobile(window.innerWidth < breakpoint);

        // Handler for window resize events
        const handleResize = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Clean up event listener
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [breakpoint]);

    return isMobile;
}

export default useMobile; 