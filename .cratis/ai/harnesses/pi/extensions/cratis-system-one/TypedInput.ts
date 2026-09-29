// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { InputSource } from './InputSource.ts';

/** What the `input` event saw for the turn about to start. */
export interface TypedInput {
    text: string;
    source: InputSource;
}
