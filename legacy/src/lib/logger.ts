// Logger levels
export enum LogLevel {
    NONE = 0,   // No logging
    ERROR = 1,  // Only errors
    WARN = 2,   // Errors and warnings
    INFO = 3,   // Errors, warnings, and info
    DEBUG = 4   // All logs
}

// Default to only show errors and warnings in production, all in development
const DEFAULT_LOG_LEVEL = import.meta.env.PROD ? LogLevel.WARN : LogLevel.INFO;

// Get log level from localStorage or use default
let currentLogLevel = DEFAULT_LOG_LEVEL;
try {
    const storedLevel = localStorage.getItem('subspace-log-level');
    if (storedLevel !== null) {
        currentLogLevel = parseInt(storedLevel, 10);
    }
} catch (e) {
    // Ignore localStorage errors
}

// Logger class
export class Logger {
    private module: string;

    constructor(module: string) {
        this.module = module;
    }

    error(message: string, ...args: any[]): void {
        if (currentLogLevel >= LogLevel.ERROR) {
            console.error(`[${this.module}] ${message}`, ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (currentLogLevel >= LogLevel.WARN) {
            console.warn(`[${this.module}] ${message}`, ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        if (currentLogLevel >= LogLevel.INFO) {
            console.info(`[${this.module}] ${message}`, ...args);
        }
    }

    debug(message: string, ...args: any[]): void {
        if (currentLogLevel >= LogLevel.DEBUG) {
            console.debug(`[${this.module}] ${message}`, ...args);
        }
    }

    // Old console.log compatibility method - maps to debug level
    log(message: string, ...args: any[]): void {
        this.debug(message, ...args);
    }
}

// Expose functions to change log level
export function setLogLevel(level: LogLevel): void {
    currentLogLevel = level;
    try {
        localStorage.setItem('subspace-log-level', level.toString());
    } catch (e) {
        // Ignore localStorage errors
    }
}

export function getLogLevel(): LogLevel {
    return currentLogLevel;
}

// Create a logger
export function createLogger(module: string): Logger {
    return new Logger(module);
} 