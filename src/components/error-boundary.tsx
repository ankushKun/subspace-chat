import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, Copy, RefreshCcw, Bug, Clock, Layers, Code, X, ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { ScrollArea } from './ui/scroll-area'
import { toast } from 'sonner'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
    errorId: string
    timestamp: Date
    isPromiseRejection: boolean
    isDismissed: boolean
    retryCount: number
}

// Declare global variable for build version
declare global {
    var __VERSION__: string | undefined
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: '',
        timestamp: new Date(),
        isPromiseRejection: false,
        isDismissed: false,
        retryCount: 0
    }

    private unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
        console.error('Unhandled promise rejection:', event.reason)

        // Create an error object from the rejection
        const error = event.reason instanceof Error
            ? event.reason
            : new Error(typeof event.reason === 'string' ? event.reason : 'Unhandled promise rejection')

        const errorId = Math.random().toString(36).substring(2, 15)
        const timestamp = new Date()

        this.setState({
            hasError: true,
            error,
            errorInfo: null,
            errorId,
            timestamp,
            isPromiseRejection: true,
            isDismissed: false
        })

        // Check if this is a critical promise rejection
        // We need to temporarily set the state to check if it's critical
        const tempState = {
            ...this.state,
            error,
            errorId,
            timestamp,
            isPromiseRejection: true
        }

        // Create a temporary instance to check if critical
        const isCritical = this.isCriticalErrorForState(tempState)

        if (!isCritical) {
            console.group('🐛 Non-critical promise rejection detected')
            console.error('Original Promise Rejection:', event.reason)
            console.error('Error Message:', error.message)
            console.error('Original Stack Trace:')
            console.error(error.stack)
            console.error('Promise Rejection Details:', {
                errorId,
                timestamp: timestamp.toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                reason: event.reason
            })
            console.groupEnd()
        } else {
            console.group('🚨 Critical promise rejection detected')
            console.error('Original Promise Rejection:', event.reason)
            console.error('Error Message:', error.message)
            console.error('Original Stack Trace:')
            console.error(error.stack)
            console.error('Promise Rejection Details:', {
                errorId,
                timestamp: timestamp.toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                reason: event.reason
            })
            console.groupEnd()
        }

        // Prevent the default browser error handling
        event.preventDefault()
    }

    public componentDidMount() {
        // Listen for unhandled promise rejections
        window.addEventListener('unhandledrejection', this.unhandledRejectionHandler)
    }

    public componentWillUnmount() {
        // Clean up the event listener
        window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler)
    }

    public static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorId: Math.random().toString(36).substring(2, 15),
            timestamp: new Date(),
            isPromiseRejection: false,
            isDismissed: false
        }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)

        this.setState({
            error,
            errorInfo
        })

        // For non-critical errors, just log and continue
        if (!this.isCriticalError()) {
            console.group('🐛 Non-critical error detected')
            console.error('Original Error:', error)
            console.error('Error Message:', error.message)
            console.error('Original Stack Trace:')
            console.error(error.stack)
            if (errorInfo.componentStack) {
                console.error('Component Stack Trace:')
                console.error(errorInfo.componentStack)
            }
            console.error('Error Details:', {
                errorId: this.state.errorId,
                timestamp: this.state.timestamp.toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
            })
            console.groupEnd()
        } else {
            console.group('🚨 Critical error detected')
            console.error('Original Error:', error)
            console.error('Error Message:', error.message)
            console.error('Original Stack Trace:')
            console.error(error.stack)
            if (errorInfo.componentStack) {
                console.error('Component Stack Trace:')
                console.error(errorInfo.componentStack)
            }
            console.error('Error Details:', {
                errorId: this.state.errorId,
                timestamp: this.state.timestamp.toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
            })
            console.groupEnd()
        }

        // Log to external service in production
        if (process.env.NODE_ENV === 'production') {
            // Add your error reporting service here (e.g., Sentry, LogRocket, etc.)
            console.error('Error ID:', this.state.errorId, {
                error,
                errorInfo,
                originalStack: error.stack,
                componentStack: errorInfo.componentStack
            })
        }
    }

    private handleReload = () => {
        window.location.reload()
    }

    private handleReset = () => {
        this.setState(prevState => ({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: '',
            timestamp: new Date(),
            isPromiseRejection: false,
            isDismissed: false,
            retryCount: prevState.retryCount + 1
        }))
    }

    private handleDismiss = () => {
        this.setState({
            isDismissed: true
        })

        toast.success('Error dismissed. The app will continue running.', {
            description: 'If you continue to experience issues, please consider reporting the bug.',
            richColors: true,
            duration: 5000
        })
    }

    private isCriticalErrorForState = (state: State): boolean => {
        // Determine if this is a critical error that should not be dismissible
        const errorMessage = state.error?.message?.toLowerCase() || ''
        const errorStack = state.error?.stack?.toLowerCase() || ''

        // Critical errors that suggest app-wide failure
        const criticalPatterns = [
            'chunk load',
            'loading chunk',
            'loading css chunk',
            'network error',
            'failed to fetch',
            'script error',
            'syntaxerror',
            'referenceerror',
            'module not found',
            'cannot resolve module'
        ]

        return criticalPatterns.some(pattern =>
            errorMessage.includes(pattern) || errorStack.includes(pattern)
        ) || state.retryCount >= 3 // After 3 retries, treat as critical
    }

    private isCriticalError = (): boolean => {
        return this.isCriticalErrorForState(this.state)
    }

    private copyErrorDetails = () => {
        const errorDetails = {
            errorId: this.state.errorId,
            timestamp: this.state.timestamp.toISOString(),
            message: this.state.error?.message,
            originalStackTrace: this.state.error?.stack,
            componentStackTrace: this.state.errorInfo?.componentStack,
            userAgent: navigator.userAgent,
            url: window.location.href,
            errorType: this.state.isPromiseRejection ? 'Promise Rejection' : 'Component Error',
            retryCount: this.state.retryCount,
            isCritical: this.isCriticalError(),
            buildInfo: {
                version: globalThis.__VERSION__ || 'unknown',
                environment: process.env.NODE_ENV
            },
            // Include the complete error object for debugging
            completeErrorDetails: {
                name: this.state.error?.name,
                message: this.state.error?.message,
                stack: this.state.error?.stack,
                cause: (this.state.error as any)?.cause,
                ...(this.state.error && Object.getOwnPropertyNames(this.state.error).reduce((acc, key) => {
                    try {
                        acc[key] = (this.state.error as any)[key]
                    } catch (e) {
                        acc[key] = '[Unable to serialize]'
                    }
                    return acc
                }, {} as any))
            }
        }

        const formattedDetails = `ERROR REPORT
=============

Error ID: ${errorDetails.errorId}
Timestamp: ${errorDetails.timestamp}
Type: ${errorDetails.errorType}
Critical: ${errorDetails.isCritical}
Retry Count: ${errorDetails.retryCount}

ERROR MESSAGE:
${errorDetails.message}

ORIGINAL STACK TRACE:
${errorDetails.originalStackTrace || 'No stack trace available'}

${errorDetails.componentStackTrace ? `COMPONENT STACK TRACE:
${errorDetails.componentStackTrace}

` : ''}ENVIRONMENT:
- URL: ${errorDetails.url}
- User Agent: ${errorDetails.userAgent}
- Build Version: ${errorDetails.buildInfo.version}
- Environment: ${errorDetails.buildInfo.environment}

COMPLETE ERROR OBJECT:
${JSON.stringify(errorDetails.completeErrorDetails, null, 2)}`

        navigator.clipboard.writeText(formattedDetails)
        toast.success('Complete error details copied to clipboard', {
            description: 'Includes original stack trace and all error properties'
        })
    }

    private reportBug = () => {
        const errorType = this.state.isPromiseRejection ? 'Promise Rejection' : 'Component Error'
        const isCritical = this.isCriticalError()
        const errorDetails = encodeURIComponent(`
**Error Type:** ${errorType}
**Severity:** ${isCritical ? 'Critical' : 'Non-Critical'}
**Error ID:** ${this.state.errorId}
**Timestamp:** ${this.state.timestamp.toISOString()}
**Message:** ${this.state.error?.message}
**URL:** ${window.location.href}
**Retry Count:** ${this.state.retryCount}

**Stack Trace:**
\`\`\`
${this.state.error?.stack}
\`\`\`

${this.state.errorInfo?.componentStack ? `**Component Stack:**
\`\`\`
${this.state.errorInfo.componentStack}
\`\`\`` : ''}

**Environment:**
- Browser: ${navigator.userAgent}
- Build: ${globalThis.__VERSION__ || 'unknown'}
- Type: ${errorType}
- Critical: ${isCritical}
`)

        // Update this URL to your actual issue tracker
        const issueUrl = `https://github.com/ankushKun/subspace-chat/issues/new?title=Error%20Report:%20${encodeURIComponent(this.state.error?.message || 'Unknown Error')}&body=${errorDetails}`
        window.open(issueUrl, '_blank')
    }

    public render() {
        // Only show error boundary UI for critical errors
        if (this.state.hasError && !this.state.isDismissed && this.isCriticalError()) {
            const errorType = this.state.isPromiseRejection ? 'Promise Rejection' : 'Component Error'
            const isCritical = this.isCriticalError()

            return (
                <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex items-center justify-center p-4">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,0,0.02)_0%,transparent_50%)] pointer-events-none" />

                    <Card className="w-full max-w-4xl mx-auto shadow-2xl border-destructive/20 relative overflow-hidden">
                        {/* Header Glow */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive/50 via-destructive to-destructive/50" />

                        {/* Close button */}
                        {!isCritical && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4 z-10 hover:bg-muted/50"
                                onClick={this.handleDismiss}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}

                        <CardHeader className="text-center pb-4">
                            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-8 h-8 text-destructive" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-destructive">
                                Critical Error Detected
                            </CardTitle>
                            <CardDescription className="text-base mt-2">
                                A critical error occurred that may affect app functionality. Please reload the page.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Error Summary */}
                            <div className="bg-muted/30 rounded-lg p-4 border border-destructive/20">
                                <div className="flex items-start gap-3">
                                    <Bug className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <h3 className="font-semibold text-foreground">Error Details</h3>
                                            <Badge variant="destructive" className="text-xs">
                                                {errorType}
                                            </Badge>
                                            <Badge variant="destructive" className="text-xs">
                                                Critical
                                            </Badge>
                                            {this.state.retryCount > 0 && (
                                                <Badge variant="outline" className="text-xs">
                                                    Retry #{this.state.retryCount}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground break-words">
                                            {this.state.error?.message || 'An unknown error occurred'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Occurred:</span>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {this.state.timestamp.toLocaleString()}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Layers className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Error ID:</span>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {this.state.errorId}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Code className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Version:</span>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {globalThis.__VERSION__ || 'dev'}
                                    </Badge>
                                </div>
                            </div>

                            <Separator />

                            {/* Technical Details */}
                            <details className="group">
                                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                    🔍 Show Technical Details
                                </summary>
                                <div className="mt-4 space-y-4">
                                    {/* Stack Trace */}
                                    {this.state.error?.stack && (
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2 text-foreground">Stack Trace:</h4>
                                            <ScrollArea className="h-32 w-full rounded-md border bg-muted/30 p-3">
                                                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                                                    {this.state.error.stack}
                                                </pre>
                                            </ScrollArea>
                                        </div>
                                    )}

                                    {/* Component Stack (only for component errors) */}
                                    {this.state.errorInfo?.componentStack && !this.state.isPromiseRejection && (
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2 text-foreground">Component Stack:</h4>
                                            <ScrollArea className="h-32 w-full rounded-md border bg-muted/30 p-3">
                                                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                                                    {this.state.errorInfo.componentStack}
                                                </pre>
                                            </ScrollArea>
                                        </div>
                                    )}

                                    {/* Environment Info */}
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2 text-foreground">Environment:</h4>
                                        <div className="text-xs space-y-1 text-muted-foreground font-mono bg-muted/30 p-3 rounded-md border">
                                            <div><strong>URL:</strong> {window.location.href}</div>
                                            <div><strong>User Agent:</strong> {navigator.userAgent}</div>
                                            <div><strong>Timestamp:</strong> {this.state.timestamp.toISOString()}</div>
                                            <div><strong>Environment:</strong> {process.env.NODE_ENV}</div>
                                            <div><strong>Error Type:</strong> {errorType}</div>
                                            <div><strong>Critical:</strong> {isCritical ? 'Yes' : 'No'}</div>
                                            <div><strong>Retry Count:</strong> {this.state.retryCount}</div>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </CardContent>

                        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6">
                            <div className="flex flex-col sm:flex-row gap-3 flex-1">
                                <Button onClick={this.handleReset} variant="outline" className="flex-1 sm:flex-none">
                                    Try Again
                                </Button>
                                <Button onClick={this.handleReload} className="flex-1 sm:flex-none">
                                    <RefreshCcw className="w-4 h-4 mr-2" />
                                    Reload Page
                                </Button>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button onClick={this.copyErrorDetails} variant="secondary" size="sm">
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Details
                                </Button>
                                <Button onClick={this.reportBug} variant="secondary" size="sm">
                                    <Bug className="w-4 h-4 mr-2" />
                                    Report Bug
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            )
        }

        // For non-critical errors or when dismissed, continue rendering children normally
        return this.props.children
    }
} 