import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import fs from "fs"
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa'
import ssl from '@vitejs/plugin-basic-ssl'


// More robust way to get package version
let packageVersion = 'DEV-FALLBACK'; // Default fallback version
try {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), { encoding: "utf-8" }));
  packageVersion = packageJson.version || packageVersion;
} catch (error) {
  console.warn('Could not read package.json version, using fallback version', error);
}

const serverSrc = fs.readFileSync("./ao/server.lua", { encoding: "utf-8" });
const aoxpressSrc = fs.readFileSync("./ao/aoxpress.lua", { encoding: "utf-8" });

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills(), VitePWA({
    registerType: 'autoUpdate',
    strategies: 'generateSW',
    injectRegister: 'auto',
    includeAssets: ['/s.png', '/stars.gif', '/audio/dum.wav', '/audio/laugh.wav', '/audio/notification.wav'],
    devOptions: {
      enabled: true
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico}'],
      // Cache app shell for offline use
      navigateFallback: 'index.html',
      maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20MB
      // Take control immediately
      clientsClaim: true,
      // More aggressive cache cleanup
      cleanupOutdatedCaches: true,
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
          // purpose: 'any maskable'
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
  // server: {
  //   host: '0.0.0.0',
  //   https: {
  //     // Generate localhost SSL certificates using mkcert:
  //     // 1. Install mkcert: https://github.com/FiloSottile/mkcert#installation
  //     // 2. Run: mkcert -install
  //     // 3. Run: mkcert localhost
  //     // This will generate localhost.pem and localhost-key.pem files
  //     key: fs.readFileSync(path.resolve(__dirname, "./localhost-key.pem")),
  //     cert: fs.readFileSync(path.resolve(__dirname, "./localhost.pem")),
  //   }

  // },
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
    "__SERVER_SRC__": JSON.stringify(serverSrc),
    "__AOXPRESS_SRC__": JSON.stringify(aoxpressSrc),
  },
  build: {
    // Ensure TypeScript helpers are properly handled
    sourcemap: false,
    minify: true,
    target: 'es2015',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      // Basic configuration for single bundle output
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        // Disable code splitting
        inlineDynamicImports: true,
        // Simple asset naming without hashes
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      }
    },
  },
})
