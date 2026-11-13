// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Selects the only shared cache directories a worker may access.
/// </summary>
/// <param name="MemoryKey">A <c>v1-</c> prefix followed by exactly 64 lowercase hexadecimal characters.</param>
/// <param name="Repositories">Relative mirror paths, using slash-separated ASCII letters, digits, dots,
/// underscores and hyphens. Segments cannot start with a dot; the final segment must end in
/// <c>.git</c> and have a nonempty name. Paths cannot overlap. At most 256 paths of 512 characters each.</param>
/// <remarks>
/// The runtime mounts the selected mirrors read-only and only this memory key's directory read-write.
/// No other cache directories are mounted. Duplicate repository paths are collapsed ordinally.
/// </remarks>
public record WorkerCacheAccess(string MemoryKey, IReadOnlyList<string> Repositories);
