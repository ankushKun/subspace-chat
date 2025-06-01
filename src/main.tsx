import './index.css'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import App from '@/pages/app'
import { HashRouter, Route, Routes } from "react-router"
import SubspaceLanding from '@/pages/landing'
import { ConnectionStrategies, useWallet } from './hooks/use-wallet'
import { useEffect } from 'react'
import NotFound from '@/pages/404'
import Settings from '@/pages/settings'
import { Toaster } from 'sonner'
import Invite from '@/pages/invite'
import { ErrorBoundary } from '@/components/error-boundary'
import Fingerprint from '@/pages/fingerprint'
import Developer from '@/pages/developer'
import DeveloperBots from '@/pages/developer/bots'

function Main() {
  const { connect } = useWallet((state) => state.actions)
  const strategy = useWallet((state) => state.connectionStrategy)
  const jwk = useWallet((state) => state.jwk)
  const { theme } = useTheme()

  useEffect(() => {
    if (strategy) {
      if (strategy == ConnectionStrategies.ScannedJWK) {
        connect(strategy, jwk).then(() => {
          console.log("connected with jwk")
        })
      } else {
        connect(strategy).then(() => {
          console.log("connected with strategy", strategy)
        })
      }
    }
  }, [strategy, jwk])

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="subspace-theme">
        <Toaster theme={theme} />
        <HashRouter>
          <Routes>
            <Route path="/" element={<SubspaceLanding />} />
            <Route path="/app" element={<App />} />
            <Route path="/app/settings" element={<Settings />} />
            <Route path="/fingerprint/:fingerprint?" element={<Fingerprint />} />
            <Route path="/invite/:invite?" element={<Invite />} />
            <Route path="/developer" element={<Developer />} />
            <Route path="/developer/bots" element={<DeveloperBots />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(<Main />)
