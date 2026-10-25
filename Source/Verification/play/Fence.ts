// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Fence {
    file: string;
    line: number;
    number: number;
    source: string;
    excerpt: boolean;
    parent?: string;
    expectedCodes: string[];
    unbound: boolean;
}
