import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const mobileTunnelEnabled = process.env.PHARMA_ENABLE_QUICK_TUNNEL === "1";
const tunnelHost = process.env.PHARMA_TUNNEL_HOST || "";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: mobileTunnelEnabled ? "127.0.0.1" : "localhost",
    port: 5173,
    strictPort: true,
    // In mobile-test mode, permit only the exact ephemeral host created by our launcher.
    // Never use allowedHosts: true; Vite warns that it enables DNS-rebinding exposure.
    allowedHosts: mobileTunnelEnabled && tunnelHost ? [tunnelHost] : [],
    ...(mobileTunnelEnabled && tunnelHost ? {
      hmr: { host: tunnelHost, protocol: "wss", clientPort: 443 }
    } : {}),
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: false,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
