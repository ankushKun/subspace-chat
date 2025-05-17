import './index.css'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ArweaveWalletKit, useConnection } from "arwalletkit-react"
import AoSyncStrategy from "@vela-ventures/aosync-strategy";
import WanderStrategy from "@arweave-wallet-kit/wander-strategy";
import BrowserWalletStrategy from "@arweave-wallet-kit/browser-wallet-strategy";
import { EthereumStrategy } from "arwalletkit-wagmi"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef } from 'react'
import { WanderConnect } from '@wanderapp/connect'
import { useGlobalState } from '@/hooks'
import { useLocalStorage } from '@uidotdev/usehooks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OfflineDetector } from '@/components/offline-detector'
import { registerServiceWorker } from '@/pwa-handler'
import { setLogLevel, LogLevel } from './lib/logger'

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
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// Loading component for use with React.lazy
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen w-screen bg-background">
    <div className="animate-spin h-10 w-10 border-4 border-accent rounded-full border-t-transparent"></div>
  </div>
);

function Main() {
  const { wanderInstance, setWanderInstance } = useGlobalState()
  const [useWC, setUseWC] = useLocalStorage("useWC", false);
  const { connect } = useConnection();

  useEffect(() => {
    if (!useWC) {
      if (wanderInstance) {
        wanderInstance.destroy();
      }
      return;
    }
    const wander = new WanderConnect({
      clientId: "FREE_TRIAL",
      button: {
        position: "static",
        theme: "dark"
      },

      onAuth: async (userDetails) => {
        console.log(userDetails)
        if (!!userDetails) {
          try {
            await connect();
            await window.arweaveWallet.connect([
              "ACCESS_ADDRESS",
              "SIGN_TRANSACTION",
              "ACCESS_PUBLIC_KEY",
              "ENCRYPT",
              "DECRYPT",
              "SIGNATURE",
            ]);
          } catch (e) {
            console.error("Error", e);
          }
        }
      }
    })


    setWanderInstance(wander);

    return () => { wander.destroy() }
  }, [useWC])

  const wc = useWC ? new BrowserWalletStrategy() : new WanderStrategy();

  return <ThemeProvider defaultTheme="dark" storageKey='subspace-ui-theme'>
    {/* <Toaster /> */}
    <QueryClientProvider client={queryClient}>
      <OfflineDetector>
        <ArweaveWalletKit
          config={{
            appInfo: {
              name: "Subspace Chat",
              // logo: "https://arweave.net/L9FExC-Wzzvmu201-he_UTH_HymCXGEemlKIJoa1_9k"
              logo: "https://arweave.net/W11lwYHNY5Ag2GsNXvn_PF9qEnqZ8c_Qgp7RqulbyE4"
            },
            permissions: [
              "ACCESS_ADDRESS",
              "SIGN_TRANSACTION",
              "ACCESS_PUBLIC_KEY",
              "ENCRYPT",
              "DECRYPT",
              "SIGNATURE",
            ],
            ensurePermissions: true,
            strategies: [
              wc,
              new AoSyncStrategy(),
              // @ts-ignore
              new EthereumStrategy()
            ]
          }}
          theme={{
            accent: { r: 160, g: 160, b: 220 },
            displayTheme: "dark"
          }}
        >
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
        </ArweaveWalletKit>
      </OfflineDetector>
    </QueryClientProvider>
  </ThemeProvider>
}

createRoot(document.getElementById('root')!).render(<Main />)
