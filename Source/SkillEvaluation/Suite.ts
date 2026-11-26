// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export type Arm = 'v1' | 'v2' | 'none';
export interface Idiom {
    id: string;
    file: string;
    kind: 'present' | 'absent';
    pattern: string;
    positive: string;
    negative: string;
}
export interface SuiteTask {
    id: string;
    area: string;
    prompt: string;
    fixture: string;
    overlay?: string;
    timeoutSeconds: number;
    pilot?: boolean;
    requiredSpecs: string[];
    idioms: Idiom[];
    expectedSkills: { v1: string[]; v2: string[] };
}
export interface Suite {
    schemaVersion: 1;
    fixtures: Record<string, { path: string; build: string; specs: string }>;
    tasks: SuiteTask[];
}
export interface SuiteOptions {
    suite: string;
    arms: Arm[];
    runs: number;
    concurrency: number;
    seed: number;
    model: string;
    thinking: 'medium';
    dryRun: boolean;
    pilot: boolean;
    task?: string;
    runDirectory?: string;
    image: string;
}
export interface Trial { key: string; task: string; arm: Arm; repetition: number }
export interface SuiteMetrics {
    input: number | null;
    output: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    reasoning: number | null;
    turns: number;
    toolCalls: number;
    /** Subscription providers: no per-token USD billing. */
    costUsd: null;
}
export interface SuiteResult extends Trial {
    area: string;
    status: 'completed' | 'agent-error' | 'infrastructure-error';
    passed: boolean;
    buildExit: number | null;
    specExit: number | null;
    idioms: { id: string; passed: boolean }[];
    metrics: SuiteMetrics;
    durationSeconds: number;
    attemptedSkills: string[];
    confirmedSkills: string[];
    /** Null for none or when the taxonomy has no resolved expected-skill mapping. */
    expectedSkills?: string[] | null;
    transcript: string;
    error?: string;
}
