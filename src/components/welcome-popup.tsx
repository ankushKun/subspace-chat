import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Users, MessageCircle } from "lucide-react"
import { useServer } from "@/hooks/subspace/server"
import type { WelcomePopupData } from "@/hooks/use-welcome-popup"

interface WelcomePopupProps {
    isOpen: boolean
    onClose: () => void
    data: WelcomePopupData
}

export default function WelcomePopup({ isOpen, onClose, data }: WelcomePopupProps) {
    const { actions: serverActions } = useServer()
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (isOpen) {
            // Small delay for animation
            setTimeout(() => setIsVisible(true), 100)
        } else {
            setIsVisible(false)
        }
    }, [isOpen])

    const handleStartTalking = () => {
        serverActions.setActiveServerId(data.serverId)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="text-center space-y-4">
                    {/* Success Icon */}
                    <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>

                    <DialogTitle className="text-xl font-semibold">
                        Welcome to {data.serverName}!
                    </DialogTitle>

                    <DialogDescription className="text-center space-y-2">
                        <p>You are now a part of <span className="font-medium text-foreground">{data.serverName}</span></p>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Users className="w-4 h-4" />
                            <span>{data.memberCount} {data.memberCount === 1 ? 'member' : 'members'}</span>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 mt-6">
                    <Button
                        onClick={handleStartTalking}
                        className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                    >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Start Talking
                    </Button>
                </div>

                {/* Decorative elements */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
                    <div className="absolute top-0 left-1/4 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl" />
                    <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-gradient-to-tl from-green-500/5 to-transparent rounded-full blur-xl" />
                </div>
            </DialogContent>
        </Dialog>
    )
} 