import React, { useState, useEffect } from "react"
import { ExternalLink, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { LinkWarningDialog } from "@/components/link-warning-dialog"

interface OpenGraphData {
    title?: string
    description?: string
    image?: string
    siteName?: string
    url?: string
    type?: string
}

interface OpenGraphEmbedProps {
    url: string
    className?: string
}

export function OpenGraphEmbed({ url, className }: OpenGraphEmbedProps) {
    const [ogData, setOgData] = useState<OpenGraphData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")

    // Clean URL for display
    const getDisplayUrl = (url: string): string => {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
            return urlObj.hostname
        } catch {
            return url
        }
    }

    // Fetch Open Graph data
    useEffect(() => {
        const fetchOpenGraphData = async () => {
            try {
                setIsLoading(true)
                setError("")

                const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

                // Attempt to fetch Open Graph data
                const ogData = await fetchRealOpenGraphData(normalizedUrl)

                if (ogData) {
                    setOgData(ogData)
                } else {
                    setError("Could not fetch preview")
                }
            } catch (error) {
                console.error("Error fetching Open Graph data:", error)
                setError("Failed to load preview")
            } finally {
                setIsLoading(false)
            }
        }

        // Only fetch for HTTP URLs
        if (url && (url.startsWith('http') || url.includes('.'))) {
            fetchOpenGraphData()
        } else {
            setIsLoading(false)
            setError("Invalid URL")
        }
    }, [url])

    // Real Open Graph data fetching function
    const fetchRealOpenGraphData = async (url: string): Promise<OpenGraphData | null> => {
        try {
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'User-Agent': 'Mozilla/5.0 (compatible; OpenGraph Bot)',
                }
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const html = await response.text()
            return parseOpenGraphFromHTML(html, url)

        } catch (error) {
            // Handle CORS and other errors gracefully
            if (error instanceof TypeError && error.message.includes('CORS')) {
                console.log('CORS policy prevented fetching Open Graph data for:', url)
            } else {
                console.error('Failed to fetch Open Graph data:', error)
            }
            return null
        }
    }

    // Parse Open Graph meta tags from HTML
    const parseOpenGraphFromHTML = (html: string, originalUrl: string): OpenGraphData => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        const getMetaContent = (property: string): string | undefined => {
            // Try og: prefix first
            let meta = doc.querySelector(`meta[property="og:${property}"]`)
            if (meta) return meta.getAttribute('content') || undefined

            // Try twitter: prefix as fallback
            meta = doc.querySelector(`meta[name="twitter:${property}"]`)
            if (meta) return meta.getAttribute('content') || undefined

            // Try standard meta tags as fallback
            if (property === 'title') {
                const titleElement = doc.querySelector('title')
                if (titleElement) return titleElement.textContent || undefined
            }

            if (property === 'description') {
                meta = doc.querySelector('meta[name="description"]')
                if (meta) return meta.getAttribute('content') || undefined
            }

            return undefined
        }

        const urlObj = new URL(originalUrl)
        const siteName = getMetaContent('site_name') || urlObj.hostname

        return {
            title: getMetaContent('title'),
            description: getMetaContent('description'),
            image: getMetaContent('image'),
            siteName: siteName,
            url: originalUrl,
            type: getMetaContent('type') || 'website'
        }
    }

    if (isLoading) {
        return (
            <div className={cn(
                "bg-gradient-to-r from-muted/20 to-muted/10 border border-border/30 rounded-lg p-3 my-2 max-w-md",
                className
            )}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded animate-pulse" />
                    <div className="flex-1">
                        <div className="w-32 h-4 bg-muted rounded animate-pulse mb-2" />
                        <div className="w-24 h-3 bg-muted rounded animate-pulse" />
                    </div>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
            </div>
        )
    }

    if (error || !ogData) {
        return (
            <div className={cn(
                "bg-gradient-to-r from-muted/10 to-muted/5 border border-border/20 rounded-lg p-3 my-2 max-w-md",
                className
            )}>
                <div className="flex items-center gap-3">
                    <LinkWarningDialog
                        href={url.startsWith('http') ? url : `https://${url}`}
                        triggerClassName="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </LinkWarningDialog>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{getDisplayUrl(url)}</p>
                        <p className="text-xs text-muted-foreground">External link</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <LinkWarningDialog
            href={url.startsWith('http') ? url : `https://${url}`}
            triggerClassName={cn(
                "block bg-gradient-to-r from-muted/10 to-muted/5 border border-border/30 rounded-lg overflow-hidden my-2 max-w-md hover:border-border/50 transition-all duration-200 group",
                className
            )}
        >
            <div className="flex">
                {/* Image */}
                {ogData.image && (
                    <div className="w-20 h-20 flex-shrink-0 bg-muted/20">
                        <img
                            src={ogData.image}
                            alt={ogData.title || "Preview image"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Hide image if it fails to load
                                e.currentTarget.style.display = 'none'
                            }}
                        />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            {/* Site name */}
                            {ogData.siteName && (
                                <p className="text-xs text-primary font-medium mb-1">
                                    {ogData.siteName}
                                </p>
                            )}

                            {/* Title */}
                            <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                {ogData.title || getDisplayUrl(url)}
                            </h3>

                            {/* Description */}
                            {ogData.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {ogData.description}
                                </p>
                            )}

                            {/* URL */}
                            <p className="text-xs text-muted-foreground/70 mt-1 truncate">
                                {getDisplayUrl(url)}
                            </p>
                        </div>

                        {/* External link icon */}
                        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                </div>
            </div>
        </LinkWarningDialog>
    )
} 