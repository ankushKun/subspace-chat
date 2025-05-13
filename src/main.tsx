import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ArweaveWalletKit } from "@arweave-wallet-kit/react"
import AoSyncStrategy from "@vela-ventures/aosync-strategy";
import WanderStrategy from "@arweave-wallet-kit/wander-strategy";



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
      <App />
    </ArweaveWalletKit>
  </ThemeProvider>
)
