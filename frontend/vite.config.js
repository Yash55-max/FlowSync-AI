import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'FlowSync AI',
                short_name: 'FlowSync',
                description: 'Real-time crowd intelligence dashboard for event operations.',
                theme_color: '#08111f',
                background_color: '#08111f',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: '/favicon.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml',
                        purpose: 'any',
                    },
                    {
                        src: '/favicon.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}'],
            },
        }),
    ],
    server: {
        port: 5173,
    },
});
