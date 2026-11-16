// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReferenceDocument } from './ReferenceDocument.ts';

/** The generated Contents block and the document whose bytes must be preserved. */
export interface ReferenceContentsEdit {
    document: ReferenceDocument;
    block: string;
    newline: string;
}
