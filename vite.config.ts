import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import opengraph from 'vite-plugin-open-graph'

import path from "path"
import fs from "fs"

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

const aoxpressSource = fs.readFileSync("./logic/aoxpress.lua", "utf-8");
const serverSource = fs.readFileSync("./logic/server.lua", "utf-8");

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills(),
    opengraph({
      basic: {
        title: "Subspace",
        type: "website",
        image: "https://subspace.ar.io/s.png",
        url: "https://subspace.ar.io",
        description: "Subspace is a communication app built on a permanent, censorship resistant and open network. It allows you to chat in online communities without the fear of censorship.",
        siteName: "Subspace",
      },
      twitter: {
        card: "summary",
        image: "https://subspace.ar.io/s.png",
        imageAlt: "Subspace Communicator",
        title: "Subspace",
        description: "Subspace is a communication app built on a permanent, censorship resistant and open network. It allows you to chat in online communities without the fear of censorship.",
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['/s.png', '/icon-192.png', '/icon-512.png', '/icon-192-maskable.png', '/icon-512-maskable.png', '/apple-touch-icon.png', '/favicon.ico', '/notification.wav'],
      devOptions: {
        enabled: true,
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024, // 50mb
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // cache html,js and css but keep them network first
            urlPattern: /\.html$|\.js$|\.css$|\.png$|\.wav$/,
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
        background_color: '#111111',
        display: "standalone",
        orientation: "any",
        scope: "./",
        start_url: "/#/app",
        categories: ["social", "communication"],
        shortcuts: [
          {
            name: "Settings",
            short_name: "Settings",
            description: "Subspace settings",
            url: "./#/app/settings"
          }
        ],
        icons: [
          {
            src: './icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: './icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: './icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }, {
            src: './icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          }, {
            src: './s.png',
            sizes: '800x800',
            type: 'image/png',
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
  server: {
    allowedHosts: ["ankush-mbp.local", "1jq3s5-ip-49-37-11-17.tunnelmole.net"],
  },
});
