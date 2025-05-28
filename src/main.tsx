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
import Invite from './pages/invite'

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
    <ThemeProvider defaultTheme="dark" storageKey="subspace-theme">
      <Toaster theme={theme} />
      <HashRouter>
        <Routes>
          <Route path="/" element={<SubspaceLanding />} />
          <Route path="/app" element={<App />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="/invite/:invite?" element={<Invite />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Main />)
