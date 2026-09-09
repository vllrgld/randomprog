import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import colors from 'picocolors';
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function lanIPv4() {
    const wifi = [];
    const other = [];

    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
        for (const address of addresses ?? []) {
            const isIPv4 = address.family === 'IPv4' || address.family === 4;

            if (!isIPv4 || address.internal || address.address.startsWith('169.254.')) {
                continue;
            }

            if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wifi')) {
                wifi.push(address.address);
            } else {
                other.push(address.address);
            }
        }
    }

    return (
        wifi[0] ??
        other.find((ip) => ip.startsWith('192.168.') || ip.startsWith('10.')) ??
        other[0] ??
        'localhost'
    );
}

const lanHost = lanIPv4();
const appLanUrl = `http://${lanHost}/`;

function printAppLanUrl() {
    return {
        name: 'print-app-lan-url',
        configureServer(server) {
            const printUrls = server.printUrls.bind(server);

            server.printUrls = () => {
                printUrls();
                server.config.logger.info(
                    `  ${colors.green('➜')}  ${colors.bold('APP Network')}: ${colors.cyan(appLanUrl)}`,
                );
            };
        },
    };
}

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        printAppLanUrl(),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
    },
    server: {
        host: true,
        port: 5173,
        strictPort: true,
        cors: true,
        origin: `http://${lanHost}:5173`,
        hmr: {
            host: lanHost,
        },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
