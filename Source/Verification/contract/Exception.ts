// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Kind } from './Kind.ts';

/** Exact line text makes an exception stop applying when the claim changes. */
export interface Exception {
    file: string;
    text: string;
    kind: Kind;
    value: string;
    reason: string;
}
