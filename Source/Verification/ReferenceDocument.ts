// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { markdownHeadings } from './skill-structure.ts';

/** Parsed navigation and original byte offsets for a reference document. */
export interface ReferenceDocument {
    content: string;
    lines: Array<{ text: string; start: number; end: number }>;
    headings: ReturnType<typeof markdownHeadings>;
}
