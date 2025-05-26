import './index.css'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from "@/components/theme-provider"
import App from '@/pages/app'
import { HashRouter, Route, Routes } from "react-router"
import SubspaceLanding from '@/pages/landing'
import { useWallet } from './hooks/use-wallet'
import { useEffect } from 'react'
import NotFound from '@/pages/404'
import Settings from '@/pages/settings'

function Main() {
  const { connect } = useWallet((state) => state.actions)
  const strategy = useWallet((state) => state.connectionStrategy)

  useEffect(() => {
    if (strategy) {
      connect(strategy).then(() => {
        console.log("connected")
      })
    }
  }, [])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="subspace-theme">
      <HashRouter>
        <Routes>
          <Route path="/" element={<SubspaceLanding />} />
          <Route path="/app" element={<App />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Main />)
