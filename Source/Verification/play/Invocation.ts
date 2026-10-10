// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Invocation {
    exit: number | null;
    output: string;
    unavailable?: string;
}
