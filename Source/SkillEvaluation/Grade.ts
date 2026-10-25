// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Grade {
    key: string;
    graderModel: string;
    results: Array<{ text: string; passed: boolean; evidence: string }>;
}
