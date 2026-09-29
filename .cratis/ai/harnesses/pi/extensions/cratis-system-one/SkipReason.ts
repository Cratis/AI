// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Why a turn did not ask System One anything. Counted and shown by `/system-one status`. */
export enum SkipReason {
    ShortPrompt = 'short prompt',
    SlashCommand = 'slash command',
    NoSkills = 'no eligible skills',
    TooManySkills = 'too many skills',
    BreakerOpen = 'circuit breaker open',
}
