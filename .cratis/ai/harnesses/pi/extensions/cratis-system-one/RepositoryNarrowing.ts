// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** What a repository's `.cratis/ai.json` said about System One. A `problem` fails closed. */
export interface RepositoryNarrowing {
    optOut: boolean;
    off: boolean;
    problem?: string;
}
