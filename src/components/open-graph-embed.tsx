import React from "react"
import { ExternalLink, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { LinkWarningDialog } from "@/components/link-warning-dialog"

interface OpenGraphEmbedProps {
    url: string
    className?: string
}

export function OpenGraphEmbed({ url, className }: OpenGraphEmbedProps) {
    // Clean URL for display
    const getDisplayUrl = (url: string): string => {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
            return urlObj.hostname
        } catch {
            return url
        }
    }

    const displayUrl = getDisplayUrl(url)
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

    return (
        <LinkWarningDialog
            href={normalizedUrl}
            triggerClassName={cn(
                "flex items-center gap-2 bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors group cursor-pointer max-w-xs mt-1 w-fit",
                className
            )}
        >
            <Globe className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors whitespace-normal break-after-all truncate">
                {displayUrl}
            </span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
        </LinkWarningDialog>
    )
} 