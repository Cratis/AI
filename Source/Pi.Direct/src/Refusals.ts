// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export type RefusalCode =
    | 'incomplete-environment'
    | 'invalid-tenant'
    | 'insecure-endpoint'
    | 'expired'
    | 'unsafe-proof'
    | 'unsupported-platform'
    | 'no-credential'
    | 'refused'
    | 'authority-lost'
    | 'already-released';

const messages: Record<RefusalCode, string> = {
    'incomplete-environment': 'The Direct launch environment is incomplete; the session was not claimed.',
    'invalid-tenant': 'The Direct tenant is missing or invalid; the session was not claimed.',
    'insecure-endpoint': 'The Direct endpoint must be https (or loopback); the session was not claimed.',
    expired: 'The launch expired or was already used; ask Direct for a new offer.',
    'unsafe-proof': 'The launch proof file failed a safety check; the session was not claimed.',
    'unsupported-platform': 'Direct local sessions are not supported on this platform yet.',
    'no-credential': 'No Direct credential was found in the OS keychain for this tenant; run /direct-link login.',
    refused: 'Direct refused the request.',
    'authority-lost': 'Claim authority for this work was lost; this session can no longer write.',
    'already-released': 'This work was already released.'
};

/** A refusal carries a fixed message only: never a path, a credential or any server text. */
export class SessionRefused extends Error {
    constructor(readonly code: RefusalCode) {
        super(messages[code]);
        this.name = 'SessionRefused';
    }
}

/** The text that is safe to show for any thrown value. */
export function describeRefusal(error: unknown): string {
    return error instanceof SessionRefused ? error.message : messages.refused;
}
