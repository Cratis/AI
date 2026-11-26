import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { EmitMetadataPlugin } from '@cratis/arc.vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    root: fileURLToPath(new URL('./', import.meta.url)),
    optimizeDeps: {
        exclude: ['tslib'],
    },
    build: {
        outDir: '../wwwroot',
        modulePreload: false,
        target: 'esnext',
        minify: false,
        cssCodeSplit: false,
    },
    plugins: [
        react(),
        tailwindcss(),
        EmitMetadataPlugin({ tsconfigPath: fileURLToPath(new URL('./tsconfig.json', import.meta.url)) }) as PluginOption,
    ],
    server: {
        port: 9000,
        open: true,
        proxy: {
            "/.cratis": {
                target: 'http://localhost:5000',
                ws: true
            },
            '/api': {
                target: 'http://localhost:5000',
                ws: true
            },
            '/swagger': {
                target: 'http://localhost:5000',
                ws: true
            }
        }
    },
});
