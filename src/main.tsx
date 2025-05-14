import './index.css'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ArweaveWalletKit } from "@arweave-wallet-kit/react"
import AoSyncStrategy from "@vela-ventures/aosync-strategy";
import WanderStrategy from "@arweave-wallet-kit/wander-strategy";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from '@/landing'
import App from '@/app'
import Settings from '@/settings'
import Invite from '@/invite'



createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="dark" storageKey='subspace-ui-theme'>
    {/* <Toaster /> */}
    <ArweaveWalletKit
      config={{
        appInfo: {
          name: "Subspace Chat",
          // logo: "https://arweave.net/L9FExC-Wzzvmu201-he_UTH_HymCXGEemlKIJoa1_9k"
          logo: "https://arweave.net/W11lwYHNY5Ag2GsNXvn_PF9qEnqZ8c_Qgp7RqulbyE4"
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
          <Route path="/user/:userId" element={<App />} />
          <Route path="/app/:serverId" element={<App />} />
          <Route path="/app/:serverId/:channelId" element={<App />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/invite/:serverId" element={<Invite />} />
          {/* <Route path='*' element={<Navigate to='/' />} /> */}
        </Routes>
      </HashRouter>
    </ArweaveWalletKit>
  </ThemeProvider>
)
