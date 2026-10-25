// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Evaluation {
    id: number;
    name: string;
    prompt: string;
    expected_output: string;
    assertions: string[];
}
