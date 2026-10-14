// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** One authoring-rule diagnostic at a physical, one-based file location. */
export interface AuthoringFinding {
    file: string;
    line: number;
    rule: string;
    matchedText: string;
}
