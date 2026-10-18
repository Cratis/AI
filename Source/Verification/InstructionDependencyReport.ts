// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AuthoringFinding } from './AuthoringFinding.ts';

/** A completed advisory comparison or an explicit skip, never an implied pass. */
export type InstructionDependencyReport =
    | { status: 'checked'; base: string; files: number; findings: AuthoringFinding[]; skippedFiles: Array<{ file: string; reason: string }> }
    | { status: 'skipped'; reason: string };
