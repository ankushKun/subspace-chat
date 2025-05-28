import { useState, useCallback } from "react"

export interface WelcomePopupData {
    serverName: string
    serverId: string
    memberCount: number
}

export function useWelcomePopup() {
    const [showWelcomePopup, setShowWelcomePopup] = useState(false)
    const [welcomeData, setWelcomeData] = useState<WelcomePopupData | null>(null)

    const showWelcome = useCallback((data: WelcomePopupData) => {
        setWelcomeData(data)
        setShowWelcomePopup(true)
    }, [])

    const hideWelcome = useCallback(() => {
        setShowWelcomePopup(false)
        setWelcomeData(null)
    }, [])

    return {
        showWelcomePopup,
        welcomeData,
        showWelcome,
        hideWelcome
    }
} 