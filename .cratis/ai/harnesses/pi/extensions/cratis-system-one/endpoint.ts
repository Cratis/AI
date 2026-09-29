// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EndpointSource } from './EndpointSource.ts';

const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost']);

export type EndpointCheck = { endpoint: string; origin: string; loopback: boolean } | { error: string };

export function isLoopbackHost(hostname: string): boolean {
    return loopbackHosts.has(hostname);
}

/**
 * Accepts an endpoint only when its source is allowed to name it. A repository may name a loopback
 * server and nothing else, because `.cratis/ai.json` belongs to whoever controls the repository. The
 * user's own environment may also name an `https` host. Credentials in the URL, query strings and
 * fragments are refused so nothing hidden travels with the request.
 */
export function checkEndpoint(value: string, source: EndpointSource): EndpointCheck {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { error: 'the endpoint is not a valid URL' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'the endpoint must use http or https' };
    if (url.username || url.password) return { error: 'the endpoint must not contain credentials' };
    if (url.search || url.hash) return { error: 'the endpoint must not contain a query string or fragment' };
    const loopback = isLoopbackHost(url.hostname);
    if (!loopback) {
        if (source === EndpointSource.Repository) return { error: 'a repository may only configure a loopback endpoint (127.0.0.1, ::1 or localhost)' };
        if (url.protocol !== 'https:') return { error: 'a non-loopback endpoint must use https' };
    }
    return { endpoint: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, origin: url.origin, loopback };
}
