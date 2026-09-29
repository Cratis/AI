// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FailureClass } from './FailureClass.ts';

export type SystemOneOutcome =
    | { ok: true; probabilities: Map<string, number>; model?: string; latencyMs: number }
    | { ok: false; failure: FailureClass; latencyMs: number; retryAfterMs?: number };
