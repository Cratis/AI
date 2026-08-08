/// <reference types="vitest/config" />

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { defineConfig } from 'vitest/config';
import react from "@vitejs/plugin-react";
import { fileURLToPath } from 'node:url';
import { EmitMetadataPlugin } from '@cratis/arc.vite';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    root: fileURLToPath(new URL('./', import.meta.url)),
    envPrefix: 'PLANNER_',
    optimizeDeps: {
        exclude: ['tslib'],
    },
    esbuild: {
        supported: {
            'top-level-await': true,
        },
    },
    build: {
        outDir: '../wwwroot',
        emptyOutDir: true,
        modulePreload: false,
        target: 'esnext',
        minify: true,
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    if (id.includes('node_modules')) {
                        if (id.includes('primereact') || id.includes('primeicons')) return 'primereact';
                        if (id.includes('react-router') || id.includes('/react-dom') || id.includes('/react/') || id.includes('/scheduler')) return 'react-vendor';
                        if (id.includes('@cratis/arc')) return 'arc';
                        if (id.includes('@cratis/fundamentals')) return 'fundamentals';
                        return undefined;
                    }
                    return undefined;
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'node',
        isolate: false,
        fileParallelism: false,
        pool: 'threads',
        exclude: ['../dist/**', '../node_modules/**', 'node_modules/**', '../wwwroot/**', 'wwwroot/**', '../**/given/**'],
        include: ['../**/for_*/when_*/**/*.ts', '../**/for_*/**/when_*.ts'],
        setupFiles: fileURLToPath(new URL('../../../.frontend/vitest.setup.ts', import.meta.url))
    },
    plugins: [
        react(),
        tailwindcss(),
        EmitMetadataPlugin({ tsconfigPath: fileURLToPath(new URL('./tsconfig.json', import.meta.url)) }) as any
    ],
    server: {
        port: 9100,
        host: true,
        open: false,
        allowedHosts: ['host.docker.internal', 'aspire.dev.internal'],
        // The repo can live on a mounted volume where macOS fsevents miss newly-created files, so the dev
        // server never resolves them until a restart. Poll for changes so new files are picked up reliably.
        watch: {
            usePolling: true,
            interval: 300
        },
        proxy: {
            '/.cratis': {
                target: 'http://localhost:5200',
                ws: true
            },
            '/api': {
                target: 'http://localhost:5200',
                ws: true
            },
            '/scalar': {
                target: 'http://localhost:5200'
            },
            '/openapi': {
                target: 'http://localhost:5200'
            }
        }
    },
    resolve: {
        dedupe: ['@cratis/fundamentals', 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
        alias: {
            'Components': fileURLToPath(new URL('../Components', import.meta.url)),
            'Layout': fileURLToPath(new URL('../Layout', import.meta.url)),
            'Issues': fileURLToPath(new URL('../Issues', import.meta.url)),
            'Repositories': fileURLToPath(new URL('../Repositories', import.meta.url)),
            'Accounts': fileURLToPath(new URL('../Accounts', import.meta.url)),
            'Work': fileURLToPath(new URL('../Work', import.meta.url)),
            'Strings': fileURLToPath(new URL('../Locales/Strings.ts', import.meta.url)),
        }
    }
});
