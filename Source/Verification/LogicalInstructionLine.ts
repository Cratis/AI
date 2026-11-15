// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A continued command and its zero-based physical line range. */
export interface LogicalInstructionLine {
    first: number;
    last: number;
    text: string;
}
