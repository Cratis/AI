// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A yes/no question. `criteria.true` describes what a yes means. */
export interface NoulQuestion {
    type: 'noul';
    instructions: string;
    criteria: { true: string };
}
