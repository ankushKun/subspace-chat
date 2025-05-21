import './index.css'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { WanderConnect } from '@wanderapp/connect'
import { useGlobalState } from '@/hooks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OfflineDetector } from '@/components/offline-detector'
import { registerServiceWorker } from '@/pwa-handler'
import { setLogLevel, LogLevel } from './lib/logger'
import { UpdatePrompt } from './components/update-prompt'
import { UpdateLoader } from './components/update-loader'
import { useWallet, ConnectionStrategies } from '@/hooks/use-wallet'

// Use React.lazy for code splitting
const Landing = lazy(() => import('@/landing'))
const App = lazy(() => import('@/app'))
const Settings = lazy(() => import('@/settings'))
const Invite = lazy(() => import('@/invite'))

// Create a QueryClient for React Query
const queryClient = new QueryClient()

// Set default log level - only errors and warnings in production
// This will drastically reduce the number of logs in the console
setLogLevel(import.meta.env.PROD ? LogLevel.ERROR : LogLevel.INFO)

// Register service worker for PWA support
registerServiceWorker();

// Loading component for use with React.lazy
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen w-screen bg-background">
    <div className="animate-spin h-10 w-10 border-4 border-accent rounded-full border-t-transparent"></div>
  </div>
);

function Main() {
  const { connect, wanderInstance, setWanderInstance, connected, connectionStrategy } = useWallet();

  return <ThemeProvider defaultTheme="dark" storageKey='subspace-ui-theme'>
    <QueryClientProvider client={queryClient}>
      <OfflineDetector>
        <UpdatePrompt />
        <UpdateLoader />
        <Toaster />
        <HashRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<App />} />
              <Route path="/app/user/:userId" element={<App />} />
              <Route path="/app/:serverId" element={<App />} />
              <Route path="/app/:serverId/:channelId" element={<App />} />
              <Route path="/app/settings" element={<Settings />} />
              <Route path="/invite" element={<Invite />} />
              <Route path="/invite/:serverId" element={<Invite />} />
              <Route path='*' element={<Navigate to='/' />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </OfflineDetector>
    </QueryClientProvider>
  </ThemeProvider>
}

createRoot(document.getElementById('root')!).render(<Main />)
