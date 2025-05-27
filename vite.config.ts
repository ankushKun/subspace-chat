import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

import path from "path"
import fs from "fs"

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

const aoxpressSource = fs.readFileSync("./logic/aoxpress.lua", "utf-8");
const serverSource = fs.readFileSync("./logic/server.lua", "utf-8");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills(), VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    devOptions: {
      enabled: true,
    },
    manifest: {
      name: 'Subspace Chat',
      short_name: 'Subspace',
      description: 'Subspace is an intergalactic communication app built on the Permaweb. It allows you to chat in online communities without the fear of censorship.',
      theme_color: '#8b5cf6',
      icons: [
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    }
  })],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
    __AOXPRESS_SRC__: JSON.stringify(aoxpressSource),
    __SERVER_SRC__: JSON.stringify(serverSource),
  },
})
