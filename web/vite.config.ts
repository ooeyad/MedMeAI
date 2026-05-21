import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Auto-generates a self-signed cert when `vite --https` (or
    // `vite preview --https`) is used, so phones on the same Wi-Fi can install
    // the PWA from your machine's LAN IP without a real cert. The first time
    // you connect, the phone will show a "Not Secure" warning — accept it once
    // and you're good for the session.
    basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker scope = root, so every route is offline-capable.
      includeAssets: ["favicon.svg", "icon.svg"],
      manifest: {
        name: "MedMeAI",
        short_name: "MedMeAI",
        description: "Medical appointment platform — book, manage, and chat with your AI assistant.",
        theme_color: "#0ea5a8",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
          { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
        ],
        categories: ["medical", "health", "productivity"],
        shortcuts: [
          {
            name: "Book appointment",
            short_name: "Book",
            url: "/appointments/book",
          },
          {
            name: "AI Assistant",
            short_name: "AI",
            url: "/ai",
          },
          {
            name: "My appointments",
            short_name: "Appointments",
            url: "/appointments",
          },
        ],
      },
      workbox: {
        // Cache the app shell on first visit so the home screen icon launches
        // even on flaky networks.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Use a network-first strategy for API GETs — fresh data when online,
        // last-good cached data when offline. Mutating verbs (POST/PUT/PATCH/
        // DELETE) bypass cache.
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*\/(patients|doctors|appointments|invoices|insurance|billing|reports|tenants|specialties|branches).*/i,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "api-get-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24,   // 1 day
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Dev: keep the service worker disabled while running `npm run dev` so
      // hot-reload isn't masked by stale caches. The install banner still
      // surfaces because we treat the manifest separately.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    // Forward API calls to the Flask backend so the phone only needs to know
    // ONE address (your machine's LAN IP) and we don't fight CORS over Wi-Fi.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
