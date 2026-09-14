import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
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

function patchPdfWorkerSource(code) {
    const open =
        '_computeFontSize(e,t,n,a,s){let{fontSize:r}=this.data.defaultAppearanceData,i=1.35*(r||12),o=Math.round(e/i);if(!r){';
    const openPatched =
        '_computeFontSize(e,t,n,a,s){let{fontSize:r}=this.data.defaultAppearanceData,i=1.35*(r||12),o=Math.round(e/i);{';
    const fit = 'r=roundWithTwoDigits(Math.min(e/1.35,t/s));';
    const fitPatched = 'r=roundWithTwoDigits(Math.max(.5,Math.min(r||e/1.35,e/1.35,t/s)));';

    if (!code.includes(open) || !code.includes(fit)) {
        throw new Error('Could not patch pdf.js to shrink long form text to the field.');
    }

    return code.replace(open, openPatched).replace(fit, fitPatched);
}

function isPdfWorkerModule(id) {
    const [pathname, query = ''] = id.split('?');

    if (!pathname.replace(/\\/g, '/').endsWith('pdf.worker.min.mjs')) {
        return false;
    }

    return !query.split('&').some((part) => part === 'url' || part.startsWith('url='));
}

function patchPdfjsWorkerFont() {
    const workerPath = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
    let patched;

    function patchedWorker() {
        patched ??= patchPdfWorkerSource(fs.readFileSync(workerPath, 'utf8'));

        return patched;
    }

    return {
        name: 'patch-pdfjs-worker-font',
        enforce: 'pre',
        transform(code, id) {
            if (!isPdfWorkerModule(id)) {
                return;
            }

            return patchPdfWorkerSource(code);
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (!isPdfWorkerModule(req.url ?? '')) {
                    next();

                    return;
                }

                res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
                res.end(patchedWorker());
            });
        },
        generateBundle(_, bundle) {
            for (const item of Object.values(bundle)) {
                const source = item.type === 'asset' ? item.source : item.code;

                if (typeof source !== 'string' || !source.includes('_computeFontSize(e,t,n,a,s)')) {
                    continue;
                }

                const next = patchPdfWorkerSource(source);

                if (item.type === 'asset') {
                    item.source = next;
                } else {
                    item.code = next;
                }
            }
        },
    };
}

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
        patchPdfjsWorkerFont(),
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
    optimizeDeps: {
        exclude: ['pdfjs-dist'],
    },
});
