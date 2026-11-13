// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>Maps an exact clone URL to its selected relative cache mirror.</summary>
/// <param name="CloneUrl">An absolute HTTPS URL without user information, query or fragment.
/// Matching and duplicate detection are ordinal; the runtime does not normalize this value.</param>
/// <param name="MirrorPath">A relative, non-hidden, slash-separated ASCII directory path ending in .git.
/// The runtime validates its segments and mounts this directory read-only.</param>
public record WorkerCacheRepository(string CloneUrl, string MirrorPath);
