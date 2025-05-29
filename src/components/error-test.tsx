import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { AlertTriangle, Bug, Zap } from 'lucide-react'

export function ErrorTest() {
    const [shouldError, setShouldError] = useState(false)

    if (shouldError) {
        // This will trigger the error boundary
        throw new Error('This is a test error to demonstrate the error boundary!')
    }

    const triggerTypeError = () => {
        // @ts-ignore - Intentionally cause a runtime error
        const obj: any = null
        obj.someProperty.deepProperty = 'test'
    }

    const triggerCriticalError = () => {
        // Simulate a critical error that should not be dismissible
        throw new Error('CHUNK LOAD ERROR: Failed to load critical module')
    }

    const triggerDismissibleError = () => {
        // Simulate a non-critical error that can be dismissed
        throw new Error('Component rendering failed: Non-critical UI component error')
    }

    const triggerAsyncError = async () => {
        // This will be caught by the promise rejection handler
        const unhandledPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Unhandled promise rejection - this should be caught by error boundary'))
            }, 100)
        })

        // Don't await - let it be unhandled
        unhandledPromise
    }

    const triggerNetworkError = () => {
        // Simulate a network-related error (critical)
        throw new Error('Network error: Failed to fetch critical data')
    }

    return (
        <Card className="w-full max-w-lg mx-auto mt-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bug className="w-5 h-5" />
                    Error Boundary Test Suite
                </CardTitle>
                <CardDescription>
                    Test the error boundary with different types of errors to see dismiss functionality
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-yellow-700">
                            These buttons will trigger different types of errors. Non-critical errors can be dismissed,
                            while critical errors require a page reload.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold mb-2 text-foreground">Dismissible Errors</h4>
                        <div className="space-y-2">
                            <Button
                                onClick={triggerDismissibleError}
                                variant="outline"
                                className="w-full"
                            >
                                <Bug className="w-4 h-4 mr-2" />
                                Trigger Dismissible Error
                            </Button>

                            <Button
                                onClick={() => setShouldError(true)}
                                variant="outline"
                                className="w-full"
                            >
                                <Bug className="w-4 h-4 mr-2" />
                                Trigger Component Error
                            </Button>

                            <Button
                                onClick={triggerTypeError}
                                variant="outline"
                                className="w-full"
                            >
                                <Bug className="w-4 h-4 mr-2" />
                                Trigger Type Error
                            </Button>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-2 text-foreground">Critical Errors (Non-dismissible)</h4>
                        <div className="space-y-2">
                            <Button
                                onClick={triggerCriticalError}
                                variant="destructive"
                                className="w-full"
                            >
                                <Zap className="w-4 h-4 mr-2" />
                                Trigger Critical Error
                            </Button>

                            <Button
                                onClick={triggerNetworkError}
                                variant="destructive"
                                className="w-full"
                            >
                                <Zap className="w-4 h-4 mr-2" />
                                Trigger Network Error
                            </Button>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-2 text-foreground">Promise Rejection</h4>
                        <Button
                            onClick={triggerAsyncError}
                            variant="secondary"
                            className="w-full"
                        >
                            <Bug className="w-4 h-4 mr-2" />
                            Trigger Unhandled Promise Rejection
                        </Button>
                    </div>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                    <p className="font-medium mb-1">Expected behavior:</p>
                    <ul className="space-y-1 text-xs">
                        <li>• <strong>Dismissible errors:</strong> Show close button and "Dismiss & Continue" option</li>
                        <li>• <strong>Critical errors:</strong> No dismiss option, require page reload</li>
                        <li>• <strong>Promise rejections:</strong> Caught by global handler</li>
                        <li>• <strong>After 3 retries:</strong> Any error becomes critical</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    )
} 