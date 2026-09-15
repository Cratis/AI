// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Hand-maintained barrel over the generated proxy tree in ./generated - the generator itself only
// emits an index.ts per generated folder (generated/Usage/index.ts, generated/Usage/Trends/index.ts,
// ...), not one at the package root, since it has no way to know this is the package root rather
// than an arbitrary output directory. Add an export line here whenever a new top-level generated
// folder appears (Providers/, Agents/, Conversations/, ... as the package grows) - the CI drift gate
// only checks ./generated, not this file, so a forgotten line here fails silently as a missing
// export rather than a build error.
export * from './generated/Harnesses';
export * from './generated/Usage';
export * from './generated/Usage/Trends';
export * from './generated/Usage/Daily';
export * from './generated/Providers/Adding';
export * from './generated/Providers/Reconfiguring';
export * from './generated/Providers/Renaming';
export * from './generated/Providers/Removing';

// Studio's provider commands are named identically to Direct's own above (AddAnthropicProvider,
// RenameAIProvider, ...) - the two really are different commands with different routes and event
// shapes (see Cratis.AI's Providers/Configuring/AnthropicProvider.cs remarks), not a naming
// accident, so a flat re-export here would collide. Reached through a namespace instead.
export * as Configuring from './generated/Providers/Configuring';
