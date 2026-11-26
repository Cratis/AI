import { readFileSync } from 'node:fs';

// Match the route emitted by the generator, rather than maintaining a second routing convention.
function routeOf(query) {
    const source = readFileSync(new URL('./generated/Features/Authors/Listing/Author.ts', import.meta.url), 'utf8');
    const classBody = source.split(`export class ${query} extends `)[1];
    const route = classBody?.match(/readonly route:\s*string\s*=\s*'([^']+)'/);
    if (!route) throw new Error(`Missing generated route for ${query}`);
    return route[1];
}

export function backend() {
    const path = routeOf('AllAuthors');
    const clients = new Set(), rows = [];
    const frame = () => 'data: ' + JSON.stringify({ data: rows, isReady: true, isAuthorized: true,
        isSuccess: true, isValid: true, hasExceptions: false, validationResults: [], exceptionMessages: [],
        paging: { page: 0, size: rows.length, totalItems: rows.length, totalPages: 1 } }) + '\n\n';
    return { name: 'authors', configureServer(server) { server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === path) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
            clients.add(res); res.write(frame()); res.on('close', () => clients.delete(res)); return;
        }
        if (pathname !== '/fixture-seed') return next();
        rows.push({ id:'00000000-0000-0000-0000-000000000001', name:'Fern' },
            { id:'00000000-0000-0000-0000-000000000002', name:'Aster' });
        for (const client of clients) client.write(frame());
        res.end('ok');
    }); } };
}
