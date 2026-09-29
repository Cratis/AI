// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A corpus skill Pi already loaded, eligible to be asked about. */
export interface SkillCandidate {
    name: string;
    description: string;
    /** Symlink-resolved path of its SKILL.md. */
    realPath: string;
}
