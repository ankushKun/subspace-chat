import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import fs from "fs"
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa'

// More robust way to get package version
let packageVersion = '1.0.0'; // Default fallback version
try {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), { encoding: "utf-8" }));
  packageVersion = packageJson.version || packageVersion;
} catch (error) {
  console.warn('Could not read package.json version, using fallback version', error);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills(), VitePWA({
    registerType: 'autoUpdate',
    strategies: 'generateSW',
    injectRegister: 'auto',
    devOptions: {
      enabled: true
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,json,woff,woff2,ttf,eot}'],
      maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      runtimeCaching: [
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
            }
          }
        }
      ]
    },
    manifest: {
      name: "Subspace Chat",
      short_name: "Subspace",
      description: "Intergalactic communication app",
      theme_color: "#000000",
      background_color: "#000000",
      display: "standalone",
      orientation: "landscape",
      scope: "./",
      start_url: "./index.html",
      icons: [
        {
          src: 's.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 's.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ],
      categories: ["social", "communication"],
      shortcuts: [
        {
          name: "Settings",
          short_name: "Settings",
          description: "Subspace settings",
          url: "/app/settings"
        }
      ]
    }
  })],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: path.resolve(
        __dirname,
        'node_modules/vite-plugin-node-polyfills/shims/buffer',
      ),
      'buffer/': path.resolve(
        __dirname,
        'node_modules/vite-plugin-node-polyfills/shims/buffer',
      ),
    },
  },
  // define global env variables
  define: {
    "__APP_VERSION__": JSON.stringify(packageVersion),
    'process.env': {
      // DO NOT EXPOSE THE ENTIRE process.env HERE - sensitive information on CI/CD could be exposed.
      URL: process.env.URL,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // Don't include service worker in input - let VitePWA handle it
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
