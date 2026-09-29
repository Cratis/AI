// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EndpointCheck } from './EndpointCheck.ts';

/** The only origin that may receive `TYPESAFE_API_KEY`. */
export const typeSafeOrigin = 'https://api.typesafe.ai';
export const typeSafeEndpoint = `${typeSafeOrigin}/v1/systemone`;

/** Expands a bracketed IPv6 literal, as the WHATWG URL parser serializes it, into eight 16-bit groups. */
function ipv6Groups(hostname: string): number[] | undefined {
    if (!hostname.startsWith('[') || !hostname.endsWith(']')) return undefined;
    const text = hostname.slice(1, -1);
    const halves = text.split('::');
    if (halves.length > 2) return undefined;
    const parse = (part: string): number[] | undefined => {
        if (part === '') return [];
        const groups = part.split(':').map(group => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : Number.NaN));
        return groups.some(Number.isNaN) ? undefined : groups;
    };
    const head = parse(halves[0]);
    const tail = halves.length === 2 ? parse(halves[1]) : [];
    if (head === undefined || tail === undefined) return undefined;
    if (halves.length === 1) return head.length === 8 ? head : undefined;
    const zeros = 8 - head.length - tail.length;
    return zeros < 1 ? undefined : [...head, ...new Array<number>(zeros).fill(0), ...tail];
}

/** The IPv4 address an IPv6 literal embeds (IPv4-mapped `::ffff:a.b.c.d` or the deprecated `::a.b.c.d`), as four bytes. */
function embeddedIPv4(groups: number[]): number[] | undefined {
    const mapped = groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff;
    const compatible = groups.slice(0, 6).every(group => group === 0) && (groups[6] !== 0 || groups[7] > 1);
    return mapped || compatible ? [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff] : undefined;
}

function ipv4Bytes(hostname: string): number[] | undefined {
    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    return match ? match.slice(1).map(Number) : undefined;
}

function withoutTrailingDot(hostname: string): string {
    return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

/**
 * Loopback for the purpose of keys: nothing in the environment may be sent here. Generous on purpose:
 * 127.0.0.0/8, `::1`, IPv4-mapped and IPv4-compatible forms of 127.x (however they were written, the
 * parser has normalized them), `localhost`, `*.localhost`, and any of these with a trailing dot.
 */
export function isLoopbackHost(hostname: string): boolean {
    const name = withoutTrailingDot(hostname.toLowerCase());
    if (name === 'localhost' || name.endsWith('.localhost')) return true;
    const v4 = ipv4Bytes(name);
    if (v4 !== undefined) return v4[0] === 127;
    const groups = ipv6Groups(name);
    if (groups === undefined) return false;
    if (groups.slice(0, 7).every(group => group === 0) && groups[7] === 1) return true;
    return embeddedIPv4(groups)?.[0] === 127;
}

/**
 * The narrower set for which plain `http` is acceptable: literal addresses in 127.0.0.0/8, `::1`, and
 * the names `localhost` and `localhost.`. A `*.localhost` name is left to https, because resolving it
 * to this machine is up to the resolver, and an IPv4-mapped literal is unusual enough to refuse.
 */
export function allowsPlainHttp(hostname: string): boolean {
    const name = hostname.toLowerCase();
    if (name === 'localhost' || name === 'localhost.') return true;
    const v4 = ipv4Bytes(name);
    if (v4 !== undefined) return v4[0] === 127;
    const groups = ipv6Groups(name);
    return groups !== undefined && groups.slice(0, 7).every(group => group === 0) && groups[7] === 1;
}

/** 0.0.0.0/8 and `::` (and their IPv4-mapped forms) mean "any address here", not a place to send anything. */
export function isUnspecifiedHost(hostname: string): boolean {
    const name = hostname.toLowerCase();
    const v4 = ipv4Bytes(name);
    if (v4 !== undefined) return v4[0] === 0;
    const groups = ipv6Groups(name);
    if (groups === undefined) return false;
    return groups.every(group => group === 0) || embeddedIPv4(groups)?.[0] === 0;
}

/**
 * Accepts an endpoint the user chose: `https`, or `http` only for `allowsPlainHttp` hosts. A bare origin
 * gets the standard `/v1/systemone` path. Credentials in the URL, query strings and fragments are refused
 * so nothing hidden travels with the request, and so are unspecified addresses (`0.0.0.0`, `::`).
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
    if (isUnspecifiedHost(url.hostname)) return { error: 'the endpoint must not be an unspecified address (0.0.0.0 or ::); use 127.0.0.1 or ::1 for a local server' };
    if (url.protocol !== 'https:' && !allowsPlainHttp(url.hostname)) return { error: 'a non-loopback endpoint must use https (http is allowed only for 127.0.0.0/8, ::1 and localhost)' };
    const path = url.pathname.replace(/\/+$/, '');
    return { endpoint: `${url.origin}${path === '' ? '/v1/systemone' : path}`, origin: url.origin, loopback: isLoopbackHost(url.hostname) };
}
