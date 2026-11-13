// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.RegularExpressions;

namespace Cratis.AI.Workers;

/// <summary>
/// Validates the shared cache contract and describes its relative mount paths.
/// </summary>
internal sealed partial class WorkerCacheMounts
{
    /// <summary>The runtime-owned exact clone URL mapping variable.</summary>
    internal const string MirrorsVariable = "CRATIS_WORKER_REPOSITORY_MIRRORS";

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

        /// <summary>A clone URL is invalid.</summary>
        RepositoryUrl,

        /// <summary>A clone URL or mirror path is repeated.</summary>
        DuplicateRepository,

        /// <summary>Repository paths overlap.</summary>
        NestedRepositories,

        /// <summary>A host path is unsuitable.</summary>
        HostPath
    }

    /// <summary>Gets whether a cache was explicitly requested.</summary>
    internal bool IsRequested { get; private init; }

    /// <summary>Gets the relative memory-key directory.</summary>
    internal string MemoryDirectory { get; private init; } = string.Empty;

    /// <summary>Gets the validated exact clone URL mappings.</summary>
    internal IReadOnlyList<WorkerCacheRepository> Repositories { get; private init; } = [];

    /// <summary>Gets the selected relative mirror paths.</summary>
    internal IEnumerable<string> MirrorPaths => Repositories.Select(repository => repository.MirrorPath);

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
            Repositories = cache.Repositories.ToArray()
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
        name.Equals(MirrorsVariable, StringComparison.OrdinalIgnoreCase) ||
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
        yield return new(MirrorsVariable, string.Join('\n', Repositories.Select(repository => $"{repository.CloneUrl}\t{ContainerPath(root, repository.MirrorPath)}")));
    }

    static Rejection Validate(WorkerCacheAccess? cache)
    {
        if (cache is null) return Rejection.None;
        if (cache.MemoryKey is null || !MemoryKeyPattern().IsMatch(cache.MemoryKey)) return Rejection.MemoryKey;
        if (cache.Repositories is null || cache.Repositories.Count > 256) return Rejection.RepositoryList;
        return ValidateRepositories(cache.Repositories);
    }

    static Rejection ValidateRepositories(IReadOnlyList<WorkerCacheRepository> repositories)
    {
        if (repositories.Any(repository => repository is null || !IsRepository(repository.MirrorPath))) return Rejection.RepositoryPath;
        if (repositories.Any(repository => !IsCloneUrl(repository.CloneUrl))) return Rejection.RepositoryUrl;
        var paths = repositories.Select(repository => repository.MirrorPath).ToArray();
        if (HasDuplicates(paths) || HasDuplicates(repositories.Select(repository => repository.CloneUrl))) return Rejection.DuplicateRepository;
        return HasNestedPaths(paths) ? Rejection.NestedRepositories : Rejection.None;
    }

    static bool HasDuplicates(IEnumerable<string> values)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        return values.Any(value => !seen.Add(value));
    }

    static bool IsCloneUrl(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != Uri.UriSchemeHttps || !uri.IsWellFormedOriginalString()) return false;
        if (url.Any(char.IsWhiteSpace) || url.Any(char.IsControl)) return false;
        if (url.Contains('?') || url.Contains('#')) return false;
        return !url[8..].Split('/')[0].Contains('@');
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
