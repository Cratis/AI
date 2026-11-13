// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Resolves scoped cache bind sources on the Docker host.
/// </summary>
/// <remarks>
/// The operator-configured root may itself be a symlink. All descendants must be ordinary directories.
/// Checks precede binding; trusted cache writers must not rename directories during launch.
/// Docker has a check-to-bind window, so launch repeats this check immediately before creation.
/// </remarks>
internal sealed class WorkerCacheHostPaths
{
    /// <summary>Gets the resolved Docker binds.</summary>
    internal IReadOnlyList<string> Binds { get; private init; } = [];

    /// <summary>Gets the rejection category.</summary>
    internal WorkerCacheMounts.Rejection Reason { get; private init; }

    /// <summary>Gets whether any selected mirror was absent.</summary>
    internal bool HasMissingRepositories { get; private init; }

    /// <summary>Gets whether host resolution succeeded.</summary>
    internal bool IsValid => Reason == WorkerCacheMounts.Rejection.None;

    /// <summary>Resolves enabled cache paths without permitting linked descendants.</summary>
    /// <param name="mounts">The validated cache plan.</param>
    /// <param name="root">The operator-configured root.</param>
    /// <param name="enabled">Whether cache access applies to this job.</param>
    /// <returns>The resolved binds or rejection category.</returns>
    internal static WorkerCacheHostPaths Resolve(WorkerCacheMounts mounts, string? root, bool enabled)
    {
        if (!enabled) return new();
        if (string.IsNullOrWhiteSpace(root) || !Path.IsPathFullyQualified(root) || root.Contains(':')) return Invalid();
        try
        {
            return ResolveDirectories(mounts, root);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return Invalid();
        }
    }

    static WorkerCacheHostPaths ResolveDirectories(WorkerCacheMounts mounts, string root)
    {
        var binds = new List<string>();
        var missing = false;
        foreach (var repository in mounts.Repositories)
        {
            if (!Check(root, repository)) return Invalid();
            var path = WorkerCacheMounts.ContainerPath(root, repository);
            if (Directory.Exists(path)) binds.Add($"{path}:{path}:ro");
            else missing = true;
        }
        if (!Check(root, mounts.MemoryDirectory)) return Invalid();
        var memory = WorkerCacheMounts.ContainerPath(root, mounts.MemoryDirectory);
        CreateMemoryDirectory(memory);
        if (!Check(root, mounts.MemoryDirectory)) return Invalid();
        binds.Add($"{memory}:{memory}:rw");
        return new() { Binds = binds, HasMissingRepositories = missing };
    }

    static bool Check(string root, string relative)
    {
        var current = root;
        foreach (var segment in relative.Split('/'))
        {
            current = Path.Combine(current, segment);
            var directory = new DirectoryInfo(current);
            if (directory.LinkTarget is not null) return false;
            if (!Path.Exists(current)) continue;
            if (directory.Attributes.HasFlag(FileAttributes.ReparsePoint) || !directory.Exists) return false;
        }
        return true;
    }

    static void CreateMemoryDirectory(string path)
    {
        if (Directory.Exists(path)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (OperatingSystem.IsWindows())
        {
            Directory.CreateDirectory(path);
        }
        else
        {
            const UnixFileMode mode = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute | UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.GroupExecute;
            Directory.CreateDirectory(path, mode);
        }
    }

    static WorkerCacheHostPaths Invalid() => new() { Reason = WorkerCacheMounts.Rejection.HostPath };
}
