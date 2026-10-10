// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Kind } from './Kind.ts';

export interface Subject {
    file: string;
    line: number;
    text: string;
    kind: Kind;
    value: string;
    owner?: string;
}
