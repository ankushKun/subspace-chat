import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import fs from "fs"

const packageJson = JSON.parse(fs.readFileSync("package.json", { encoding: "utf-8" }))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // define global env variables
  define: {
    "APP_VERSION": JSON.stringify(packageJson.version),
  },
})
