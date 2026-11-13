// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.RegularExpressions;

namespace Cratis.AI.Workers;

/// <summary>
/// Validates the shared cache contract and describes its relative mount paths.
/// </summary>
internal sealed partial class WorkerCacheMounts
{
    /// <summary>Identifies a cache rejection without including caller-supplied values.</summary>
    internal enum Rejection
    {
        /// <summary>The request is valid.</summary>
        None,

        /// <summary>The memory key is invalid.</summary>
        MemoryKey,

        /// <summary>The repository list is missing or too large.</summary>
        RepositoryList,

        /// <summary>A repository path is invalid.</summary>
        RepositoryPath,

        /// <summary>Repository paths overlap.</summary>
        NestedRepositories,

        /// <summary>A host path is unsuitable.</summary>
        HostPath
    }

    /// <summary>Gets whether a cache was explicitly requested.</summary>
    internal bool IsRequested { get; private init; }

    /// <summary>Gets the relative memory-key directory.</summary>
    internal string MemoryDirectory { get; private init; } = string.Empty;

    /// <summary>Gets the distinct relative mirror paths.</summary>
    internal IReadOnlyList<string> Repositories { get; private init; } = [];

    /// <summary>Gets the rejection category.</summary>
    internal Rejection Reason { get; private init; }

    /// <summary>Validates an optional cache request.</summary>
    /// <param name="cache">The requested cache access.</param>
    /// <param name="mounts">The validated plan or rejection category.</param>
    /// <returns>Whether the request is valid.</returns>
    internal static bool TryCreate(WorkerCacheAccess? cache, out WorkerCacheMounts mounts)
    {
        var reason = Validate(cache);
        mounts = new() { Reason = reason };
        if (reason != Rejection.None || cache is null)
        {
            return reason == Rejection.None;
        }
        mounts = new()
        {
            IsRequested = true,
            MemoryDirectory = $".agent-memory/{cache.MemoryKey}",
            Repositories = cache.Repositories.Distinct(StringComparer.Ordinal).ToArray()
        };
        return true;
    }

    /// <summary>Creates a validated plan for a pure specification builder.</summary>
    /// <param name="cache">The requested cache access.</param>
    /// <returns>The validated plan.</returns>
    /// <exception cref="ArgumentException">The cache request is invalid.</exception>
    internal static WorkerCacheMounts Create(WorkerCacheAccess? cache) =>
        TryCreate(cache, out var mounts) ? mounts : throw new ArgumentException("Invalid worker cache request.", nameof(cache));

    /// <summary>Identifies environment names reserved for runtime cache paths.</summary>
    /// <param name="name">The caller-supplied variable name.</param>
    /// <param name="configuredVariable">The configured cache variable.</param>
    /// <returns>Whether the runtime owns the variable.</returns>
    internal static bool IsEnvironmentVariable(string name, string? configuredVariable) =>
        name.Equals("DIRECT_MEMORY_PATH", StringComparison.OrdinalIgnoreCase) ||
        name.Equals("DIRECT_REPOSITORY_CACHE", StringComparison.OrdinalIgnoreCase) ||
        name.Equals(configuredVariable, StringComparison.OrdinalIgnoreCase);

    /// <summary>Combines a container cache root and a validated relative path.</summary>
    /// <param name="root">The configured container root.</param>
    /// <param name="relative">The relative mount path.</param>
    /// <returns>The container path.</returns>
    internal static string ContainerPath(string root, string relative) => $"{root.TrimEnd('/')}/{relative}";

    /// <summary>Determines whether the job's mode and configuration permit cache mounts.</summary>
    /// <param name="job">The worker job.</param>
    /// <param name="root">The configured cache root.</param>
    /// <param name="hostPrepared">Whether a host workspace is used.</param>
    /// <returns>Whether to apply the plan.</returns>
    internal bool AppliesTo(WorkerJob job, string? root, bool hostPrepared = false) =>
        IsRequested && !string.IsNullOrWhiteSpace(root) && !hostPrepared &&
        !job.EnvironmentVariables.ContainsKey("DIRECT_REPOSITORY_CHECKOUTS") &&
        !job.EnvironmentVariables.ContainsKey(HostWorkspace.ModeVariable);

    /// <summary>Builds the runtime-owned paths for applied cache mounts.</summary>
    /// <param name="root">The configured cache root.</param>
    /// <param name="variable">The configured cache variable.</param>
    /// <returns>The cache and memory environment values.</returns>
    internal IEnumerable<KeyValuePair<string, string>> Environment(string root, string? variable)
    {
        if (!string.IsNullOrWhiteSpace(variable))
        {
            yield return new(variable, root);
        }
        yield return new("DIRECT_MEMORY_PATH", ContainerPath(root, $"{MemoryDirectory}/memory.jsonl"));
    }

    static Rejection Validate(WorkerCacheAccess? cache)
    {
        if (cache is null) return Rejection.None;
        if (cache.MemoryKey is null || !MemoryKeyPattern().IsMatch(cache.MemoryKey)) return Rejection.MemoryKey;
        if (cache.Repositories is null || cache.Repositories.Count > 256) return Rejection.RepositoryList;
        if (cache.Repositories.Any(path => !IsRepository(path))) return Rejection.RepositoryPath;
        return HasNestedPaths(cache.Repositories) ? Rejection.NestedRepositories : Rejection.None;
    }

    static bool IsRepository(string? path)
    {
        if (string.IsNullOrEmpty(path)) return false;
        if (path.Length > 512) return false;
        if (!path.EndsWith(".git", StringComparison.Ordinal)) return false;
        var segments = path.Split('/');
        return segments[^1].Length > 4 && segments.All(segment => SegmentPattern().IsMatch(segment));
    }

    static bool HasNestedPaths(IReadOnlyList<string> paths)
    {
        var unique = paths.ToHashSet(StringComparer.Ordinal);
        return unique.Any(path => path.Select((character, index) => (character, index))
            .Any(part => part.character == '/' && unique.Contains(path[..part.index])));
    }

    [GeneratedRegex(@"\Av1-[0-9a-f]{64}\z", RegexOptions.CultureInvariant, 1000)]
    private static partial Regex MemoryKeyPattern();

    [GeneratedRegex(@"\A[A-Za-z0-9_-][A-Za-z0-9._-]*\z", RegexOptions.CultureInvariant, 1000)]
    private static partial Regex SegmentPattern();
}
