import { createRoot } from 'react-dom/client'
import './index.css'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ArweaveWalletKit } from "@arweave-wallet-kit/react"
import AoSyncStrategy from "@vela-ventures/aosync-strategy";
import WanderStrategy from "@arweave-wallet-kit/wander-strategy";
import { HashRouter, Route, Routes } from "react-router-dom";
import Landing from '@/landing'
import App from '@/app'
import Settings from '@/settings'



createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="dark" storageKey='subspace-ui-theme'>
    {/* <Toaster /> */}
    <ArweaveWalletKit
      config={{
        appInfo: {
          name: "Subspace Chat",
          logo: ""
        },
        permissions: [
          "ACCESS_ADDRESS",
          "SIGN_TRANSACTION"
        ],
        ensurePermissions: true,
        strategies: [new WanderStrategy(), new AoSyncStrategy()]
      }}
      theme={{
        accent: { r: 160, g: 160, b: 220 },
        displayTheme: "dark"
      }}
    >
      <Toaster />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<App />} />
          <Route path="/app/settings" element={<Settings />} />
        </Routes>
      </HashRouter>
    </ArweaveWalletKit>
  </ThemeProvider>
)
