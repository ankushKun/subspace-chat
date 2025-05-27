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
    includeAssets: ['/s.png', '/favicon.ico'],
    devOptions: {
      enabled: true,
    },
    workbox: {
      maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20mb
      clientsClaim: true,
      skipWaiting: true,
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          // cache html,js and css but keep them network first
          urlPattern: /\.html$|\.js$|\.css$|\.png/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'app-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 5 * 60, // 5 minutes
            }
          }
        },
        {
          // arweave.net/*
          urlPattern: /arweave\.net\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'arweave-net-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 15 * 60, // 15 minutes
            }
          }
        },
        {
          // All other assets load from network
          urlPattern: /.*/,
          handler: 'NetworkOnly'
        }
      ]
    },
    manifest: {
      name: 'Subspace Chat',
      short_name: 'Subspace',
      description: 'Subspace is an intergalactic communication app built on the Permaweb. It allows you to chat in online communities without the fear of censorship.',
      theme_color: '#111111',
      display: "standalone",
      orientation: "any",
      scope: "/",
      start_url: "/#/app",
      categories: ["social", "communication"],
      shortcuts: [
        {
          name: "Settings",
          short_name: "Settings",
          description: "Subspace settings",
          url: "/#/app/settings"
        }
      ],
      icons: [
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }, {
          src: '/icon-192-maskable.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        }
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
