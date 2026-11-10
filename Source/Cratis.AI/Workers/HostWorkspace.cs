// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

internal enum HostWorkspaceVerdictKind
{
    NotHostPrepared,
    Valid,
    UnknownMode,
    NotConfigured,
    PathMissing,
    NotAbsolute,
    Traversal,
    InvalidCharacters,
    Symlink,
    OutsideRoot,
    IsRoot,
    NotADirectory,
    ForbiddenCredential,
    ConflictsWithBundleDiff,
    UnsupportedRuntime
}

internal sealed record HostWorkspaceVerdict(HostWorkspaceVerdictKind Kind, string? Path = null);

internal static class HostWorkspace
{
    internal const string ModeVariable = "CRATIS_WORKSPACE_MODE";
    internal const string ModeValue = "host-prepared";
    internal const string HostPathVariable = "CRATIS_WORKSPACE_HOST_PATH";
    internal const string ContainerPathVariable = "CRATIS_WORKSPACE_PATH";
    internal const string ContainerPath = "/workspace";

    static readonly string[] ForbiddenInputs =
    [
        "GITHUB_TOKEN", "GH_TOKEN", "DIRECT_PUSH_TOKEN_URL", "DIRECT_CLONE_CREDENTIALS",
        "DIRECT_REPOSITORY_URL", "DIRECT_REPOSITORY_URLS", "DIRECT_REPOSITORY_CHECKOUTS",
        "DIRECT_REPOSITORY_CACHE", "DIRECT_BRANCH"
    ];

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
        return ForbiddenInputs.Any(input => job.EnvironmentVariables.ContainsKey(input) || job.Secrets.ContainsKey(input))
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
        var lexicalError = ValidateLexicalPath(path);
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
            ? new(HostWorkspaceVerdictKind.Valid, path)
            : new(HostWorkspaceVerdictKind.NotADirectory);
    }

    static bool RootIsConfigured(string? root) => !string.IsNullOrWhiteSpace(root) && Path.IsPathFullyQualified(root) && Directory.Exists(root);

    static bool IsLink(DirectoryInfo directory) => directory.LinkTarget is not null || (directory.Exists && directory.Attributes.HasFlag(FileAttributes.ReparsePoint));

    static HostWorkspaceVerdictKind? ValidateLexicalPath(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return HostWorkspaceVerdictKind.PathMissing;
        }
        if (path.IndexOfAny(['\n', '\r', '\0', ':', ',']) >= 0)
        {
            return HostWorkspaceVerdictKind.InvalidCharacters;
        }
        if (!Path.IsPathFullyQualified(path))
        {
            return HostWorkspaceVerdictKind.NotAbsolute;
        }
        if (path == Path.GetPathRoot(path))
        {
            return HostWorkspaceVerdictKind.IsRoot;
        }
        return path[Path.GetPathRoot(path)!.Length..].Split(Path.DirectorySeparatorChar).Any(segment => segment is "" or "." or "..")
            ? HostWorkspaceVerdictKind.Traversal
            : null;
    }
}
