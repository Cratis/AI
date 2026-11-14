// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Fence } from './Fence.ts';

/** A composed fence and its temporary compilation workspace. */
export interface Compilation {
    fence: Fence;
    source: string;
    directory: string;
    location: string;
}
