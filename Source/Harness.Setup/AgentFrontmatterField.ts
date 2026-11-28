// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A top-level canonical agent field and the source context needed for parsing diagnostics. */
export interface AgentFrontmatterField {
    file: string;
    frontmatter: string[];
    key: string;
}
