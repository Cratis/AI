// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Identifies the first failed host-workspace check, or an accepted workspace mode.
/// </summary>
internal enum HostWorkspaceVerdictKind
{
    /// <summary>The job uses the default workspace mode.</summary>
    NotHostPrepared,

    /// <summary>The host workspace is valid.</summary>
    Valid,

    /// <summary>The workspace mode is unknown.</summary>
    UnknownMode,

    /// <summary>The host has no usable workspace root.</summary>
    NotConfigured,

    /// <summary>The job has no workspace path.</summary>
    PathMissing,

    /// <summary>The path is not absolute.</summary>
    NotAbsolute,

    /// <summary>The path contains noncanonical segments.</summary>
    Traversal,

    /// <summary>The path contains unsafe characters.</summary>
    InvalidCharacters,

    /// <summary>The path or Git metadata is a symbolic link.</summary>
    Symlink,

    /// <summary>The path is outside the configured root.</summary>
    OutsideRoot,

    /// <summary>The path names the root itself.</summary>
    IsRoot,

    /// <summary>The path does not name an existing directory.</summary>
    NotADirectory,

    /// <summary>The job supplies a forbidden repository input.</summary>
    ForbiddenCredential,

    /// <summary>The job requests the incompatible bundle-diff mode.</summary>
    ConflictsWithBundleDiff,

    /// <summary>The runtime cannot mount a host workspace.</summary>
    UnsupportedRuntime,

    /// <summary>The workspace is not a direct child of the root.</summary>
    NestedPath,

    /// <summary>The Git metadata cannot be protected by read-only binds.</summary>
    InvalidGitMetadata
}

/// <summary>
/// Captures validation status and the accepted paths to mount.
/// </summary>
/// <param name="Kind">The validation outcome.</param>
/// <param name="Path">The accepted workspace path.</param>
/// <param name="GitMetadataPath">An additional metadata subtree to protect.</param>
internal sealed record HostWorkspaceVerdict(HostWorkspaceVerdictKind Kind, string? Path = null, string? GitMetadataPath = null);

/// <summary>
/// Validates host-prepared jobs before contacting a container runtime.
/// </summary>
internal static class HostWorkspace
{
    /// <summary>The workspace mode environment variable.</summary>
    internal const string ModeVariable = "CRATIS_WORKSPACE_MODE";

    /// <summary>The host-prepared mode value.</summary>
    internal const string ModeValue = "host-prepared";

    /// <summary>The host workspace path environment variable.</summary>
    internal const string HostPathVariable = "CRATIS_WORKSPACE_HOST_PATH";

    /// <summary>The container workspace path environment variable.</summary>
    internal const string ContainerPathVariable = "CRATIS_WORKSPACE_PATH";

    /// <summary>The fixed container workspace path.</summary>
    internal const string ContainerPath = "/workspace";

    static readonly string[] _forbiddenInputs =
    [
        "GITHUB_TOKEN", "GH_TOKEN", "DIRECT_PUSH_TOKEN_URL", "DIRECT_CLONE_CREDENTIALS",
        "DIRECT_REPOSITORY_URL", "DIRECT_REPOSITORY_URLS", "DIRECT_REPOSITORY_CHECKOUTS",
        "DIRECT_REPOSITORY_CACHE", "DIRECT_BRANCH"
    ];

    /// <summary>
    /// Validates the job's workspace mode, repository inputs, path, and Git metadata.
    /// </summary>
    /// <param name="job">The requested job.</param>
    /// <param name="root">The host's configured workspace root.</param>
    /// <returns>The first validation failure or the accepted workspace.</returns>
    internal static HostWorkspaceVerdict Validate(WorkerJob job, string? root)
    {
        job.EnvironmentVariables.TryGetValue(ModeVariable, out var mode);
        if (string.IsNullOrEmpty(mode))
        {
            return new(HostWorkspaceVerdictKind.NotHostPrepared);
        }
        if (mode != ModeValue)
        {
            return new(HostWorkspaceVerdictKind.UnknownMode);
        }
        return ValidateRequest(job) ?? ValidatePath(job, root);
    }

    static HostWorkspaceVerdict? ValidateRequest(WorkerJob job)
    {
        if (job.EnvironmentVariables.TryGetValue("DIRECT_RUN_MODE", out var mode) && mode == "bundle-diff")
        {
            return new(HostWorkspaceVerdictKind.ConflictsWithBundleDiff);
        }
        return _forbiddenInputs.Any(input => job.EnvironmentVariables.ContainsKey(input) || job.Secrets.ContainsKey(input))
            ? new(HostWorkspaceVerdictKind.ForbiddenCredential)
            : null;
    }

    static HostWorkspaceVerdict ValidatePath(WorkerJob job, string? root)
    {
        if (!RootIsConfigured(root))
        {
            return new(HostWorkspaceVerdictKind.NotConfigured);
        }
        job.EnvironmentVariables.TryGetValue(HostPathVariable, out var path);
        var lexicalError = new HostWorkspacePath(path).Validate();
        if (lexicalError is not null)
        {
            return new(lexicalError.Value);
        }
        var canonicalRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root!));
        var canonicalPath = Path.GetFullPath(path!);
        if (canonicalPath == canonicalRoot)
        {
            return new(HostWorkspaceVerdictKind.IsRoot);
        }
        var prefix = Path.EndsInDirectorySeparator(canonicalRoot) ? canonicalRoot : canonicalRoot + Path.DirectorySeparatorChar;
        if (!canonicalPath.StartsWith(prefix, StringComparison.Ordinal))
        {
            return new(HostWorkspaceVerdictKind.OutsideRoot);
        }
        var relativePath = Path.GetRelativePath(canonicalRoot, canonicalPath);
        if (relativePath.Contains(Path.DirectorySeparatorChar))
        {
            return new(HostWorkspaceVerdictKind.NestedPath);
        }
        return ValidateDescendant(canonicalRoot, canonicalPath);
    }

    static HostWorkspaceVerdict ValidateDescendant(string root, string path)
    {
        var current = root;
        foreach (var segment in Path.GetRelativePath(root, path).Split(Path.DirectorySeparatorChar))
        {
            current = Path.Combine(current, segment);
            var directory = new DirectoryInfo(current);
            if (IsLink(directory))
            {
                return new(HostWorkspaceVerdictKind.Symlink);
            }
        }
        return Directory.Exists(path)
            ? new HostWorkspaceMetadata(new DirectoryInfo(path)).Validate()
            : new(HostWorkspaceVerdictKind.NotADirectory);
    }

    static bool RootIsConfigured(string? root) => !string.IsNullOrWhiteSpace(root) && Path.IsPathFullyQualified(root) && Directory.Exists(root);

    /// <summary>
    /// Checks existing entries and dangling links without following them.
    /// </summary>
    /// <param name="entry">The filesystem entry.</param>
    /// <returns>Whether the entry is a symbolic link or reparse point.</returns>
    internal static bool IsLink(FileSystemInfo entry) => entry.LinkTarget is not null || (entry.Exists && entry.Attributes.HasFlag(FileAttributes.ReparsePoint));
}
