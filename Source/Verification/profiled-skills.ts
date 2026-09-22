// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export function unprofiledSkills(skillNames: string[], profiles: Array<{ availableTargets?: string[] }>): string[] {
    const reachable = new Set(profiles.flatMap(profile => profile.availableTargets ?? []));
    return skillNames.filter(name => !reachable.has(name));
}
