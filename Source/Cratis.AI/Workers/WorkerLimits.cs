// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Optional per-job Docker resource ceilings. Zero leaves the corresponding resource unlimited.
/// </summary>
/// <param name="MemoryBytes">The memory ceiling in bytes; swap is disabled for a bounded job.</param>
/// <param name="NanoCpus">The CPU ceiling in billionths of a CPU.</param>
/// <param name="PidsLimit">The maximum number of processes.</param>
public record WorkerLimits(long MemoryBytes = 0, long NanoCpus = 0, long PidsLimit = 0);
