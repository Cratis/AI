// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Physical instruction lines and the added line numbers eligible for findings. */
export interface InstructionDependencySource {
    file: string;
    lines: string[];
    added: Set<number>;
}
