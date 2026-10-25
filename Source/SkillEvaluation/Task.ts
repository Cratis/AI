// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export interface Task {
    key: string;
    skill: string;
    index: number;
    run: number;
    prompt: string;
    withSkills: boolean;
    shouldTrigger?: boolean;
    name?: string;
    expectedOutput?: string;
    assertions?: string[];
}
