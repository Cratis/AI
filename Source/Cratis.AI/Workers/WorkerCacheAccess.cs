// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>Selects only the cache directories a worker job needs. Null on the job mounts no cache.</summary>
/// <param name="MemoryKey">An opaque key: exactly v1- followed by 64 lowercase hexadecimal characters.</param>
/// <param name="Repositories">Exact clone URL to relative mirror path mappings, at most 256 entries.
/// URLs are absolute HTTPS without user information, query or fragment. Paths are at most 512
/// characters; slash-separated ASCII segments cannot start with a dot, and the final segment is
/// a nonempty name ending in .git. Duplicate URLs or paths (ordinal), nested paths, absolute paths,
/// traversal, backslashes and control characters are invalid. An empty list requests memory only.</param>
public record WorkerCacheAccess(string MemoryKey, IReadOnlyList<WorkerCacheRepository> Repositories);
