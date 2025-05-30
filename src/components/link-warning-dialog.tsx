import React, { useState } from "react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ExternalLink, AlertTriangle, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface LinkWarningDialogProps {
    href: string
    children: React.ReactNode
    className?: string
    triggerClassName?: string
}

export function LinkWarningDialog({
    href,
    children,
    className,
    triggerClassName
}: LinkWarningDialogProps) {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <span
                    className={cn(
                        "text-blue-500 hover:underline cursor-pointer",
                        triggerClassName
                    )}
                >
                    {children}
                </span>
            </DialogTrigger>
            <DialogContent className={cn("max-w-md", className)}>
                <div className="space-y-6">
                    {/* Header with icon */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-foreground">External Link Warning</h3>
                            <p className="text-sm text-muted-foreground">Security check required</p>
                        </div>
                    </div>

                    {/* Warning message */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <div className="flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    You're about to leave Subspace
                                </p>
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    This link was shared by another user. Please verify it's safe before proceeding.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Link details */}
                    <div className="space-y-3">
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                    Link Text
                                </p>
                                <p className="text-sm font-mono bg-background border rounded px-2 py-1 break-all">
                                    {children}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                    Destination URL
                                </p>
                                <p className="text-sm font-mono bg-background border rounded px-2 py-1 break-all text-blue-600 dark:text-blue-400">
                                    {href}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-4 py-2"
                            onClick={() => setOpen(false)}
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open Link
                        </a>
                        <button
                            className="px-4 py-2 h-11 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
} 