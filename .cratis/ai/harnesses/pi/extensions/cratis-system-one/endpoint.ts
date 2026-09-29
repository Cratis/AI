// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EndpointCheck } from './EndpointCheck.ts';

const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost']);

/** The only origin that may receive `TYPESAFE_API_KEY`. */
export const typeSafeOrigin = 'https://api.typesafe.ai';
export const typeSafeEndpoint = `${typeSafeOrigin}/v1/systemone`;

export function isLoopbackHost(hostname: string): boolean {
    return loopbackHosts.has(hostname);
}

/**
 * Accepts an endpoint the user chose: `https`, or `http` only for loopback. A bare origin gets the
 * standard `/v1/systemone` path. Credentials in the URL, query strings and fragments are refused so
 * nothing hidden travels with the request.
 */
export function checkEndpoint(value: string): EndpointCheck {
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        return { error: 'the endpoint is not a valid URL' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'the endpoint must use http or https' };
    if (url.username || url.password) return { error: 'the endpoint must not contain credentials' };
    if (url.search || url.hash) return { error: 'the endpoint must not contain a query string or fragment' };
    const loopback = isLoopbackHost(url.hostname);
    if (!loopback && url.protocol !== 'https:') return { error: 'a non-loopback endpoint must use https (http is allowed only for 127.0.0.1, ::1 and localhost)' };
    const path = url.pathname.replace(/\/+$/, '');
    return { endpoint: `${url.origin}${path === '' ? '/v1/systemone' : path}`, origin: url.origin, loopback };
}
