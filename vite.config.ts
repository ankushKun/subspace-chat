import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import fs from "fs"
import { nodePolyfills } from 'vite-plugin-node-polyfills';


const packageJson = JSON.parse(fs.readFileSync("package.json", { encoding: "utf-8" }))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills()],
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
    "APP_VERSION": JSON.stringify(packageJson.version),
    'process.env': {
      // DO NOT EXPOSE THE ENTIRE process.env HERE - sensitive information on CI/CD could be exposed.
      URL: process.env.URL,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // Ensure service worker is included in the build
        'service-worker': path.resolve(__dirname, 'public/service-worker.js'),
        'register-sw': path.resolve(__dirname, 'public/register-sw.js'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
