// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Hand-maintained barrel over the generated proxy tree in ./generated - the generator itself only
// emits an index.ts per generated folder (generated/Usage/index.ts, generated/Usage/Trends/index.ts,
// ...), not one at the package root, since it has no way to know this is the package root rather
// than an arbitrary output directory. Add an export line here whenever a new top-level generated
// folder appears (Providers/, Agents/, Conversations/, ... as the package grows) - the CI drift gate
// only checks ./generated, not this file, so a forgotten line here fails silently as a missing
// export rather than a build error.
//
// ./generated/Providers/Configuring is deliberately absent: that namespace declares commands with
// the same names as the ones in Adding, Reconfiguring, Removing and Renaming, so exporting both
// flatly is ambiguous. Import it by path when it is needed.
export * from './generated/Agents';
export * from './generated/Agents/Configuring';
export * from './generated/Agents/Listing';
export * from './generated/Agents/Skills';
export * from './generated/Agents/Skills/Adding';
export * from './generated/Agents/Skills/Removing';
export * from './generated/Agents/Skills/Updating';
export * from './generated/Decisions/Adding';
export * from './generated/Decisions/Reconfiguring';
export * from './generated/Harnesses';
export * from './generated/Providers';
export * from './generated/Providers/Adding';
export * from './generated/Providers/AvailableModels';
export * from './generated/Providers/Capabilities';
export * from './generated/Providers/Codex';
export * from './generated/Providers/Copilot';
export * from './generated/Providers/Listing';
export * from './generated/Providers/Pools/AddingProvider';
export * from './generated/Providers/Pools/Creating';
export * from './generated/Providers/Pools/Listing';
export * from './generated/Providers/Pools/Removing';
export * from './generated/Providers/Pools/RemovingProvider';
export * from './generated/Providers/Pools/Renaming';
export * from './generated/Providers/RateLimiting';
export * from './generated/Providers/Reconfiguring';
export * from './generated/Providers/Refreshing';
export * from './generated/Providers/Removing';
export * from './generated/Providers/Renaming';
export * from './generated/Providers/SettingConcurrency';
export * from './generated/Providers/SettingTierModels';
export * from './generated/Providers/SettingUsageCapacity';
export * from './generated/Providers/SigningIn';
export * from './generated/Providers/UsageReporting';
export * from './generated/Providers/UsageReporting/RecordingSnapshot';
export * from './generated/Providers/UsageReporting/SettingCredential';
export * from './generated/Providers/UsageReporting/Snapshots';
export * from './generated/Usage';
export * from './generated/Usage/Daily';
export * from './generated/Usage/Trends';
