import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import fs from "fs"

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

const aoxpressSource = fs.readFileSync("./logic/aoxpress.lua", "utf-8");
const serverSource = fs.readFileSync("./logic/server.lua", "utf-8");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
