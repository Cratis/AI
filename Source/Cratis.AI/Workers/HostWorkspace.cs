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
    UnsupportedRuntime,
    NestedPath,
    InvalidGitMetadata
}

internal sealed record HostWorkspaceVerdict(HostWorkspaceVerdictKind Kind, string? Path = null, string? GitMetadataPath = null);

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
            ? ValidateGitMetadata(path)
            : new(HostWorkspaceVerdictKind.NotADirectory);
    }

    static HostWorkspaceVerdict ValidateGitMetadata(string workspace)
    {
        var entry = Path.Combine(workspace, ".git");
        if (IsLink(new DirectoryInfo(entry)) || IsLink(new FileInfo(entry)))
        {
            return new(HostWorkspaceVerdictKind.Symlink);
        }
        if (Directory.Exists(entry))
        {
            return new(HostWorkspaceVerdictKind.Valid, workspace);
        }
        if (!File.Exists(entry))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        try
        {
            return ValidateGitFile(workspace, File.ReadAllText(entry).TrimEnd('\r', '\n'));
        }
        catch (IOException)
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        catch (UnauthorizedAccessException)
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
    }

    static HostWorkspaceVerdict ValidateGitFile(string workspace, string content)
    {
        const string prefix = "gitdir: ";
        if (!content.StartsWith(prefix, StringComparison.Ordinal))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        var target = content[prefix.Length..];
        // Absolute host gitdir names do not resolve under the container's /workspace remapping.
        if (string.IsNullOrWhiteSpace(target) || target != target.Trim() || Path.IsPathFullyQualified(target) || target.IndexOfAny(['\n', '\r', '\0', ':', ',']) >= 0)
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        var targetSegments = target.Split(Path.DirectorySeparatorChar);
        if (targetSegments.Any(segment => segment is "" or "." or ".."))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        var gitDirectory = Path.GetFullPath(target, workspace);
        if (!gitDirectory.StartsWith(workspace + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !Directory.Exists(gitDirectory))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        var relative = Path.GetRelativePath(workspace, gitDirectory);
        var current = workspace;
        foreach (var segment in relative.Split(Path.DirectorySeparatorChar))
        {
            current = Path.Combine(current, segment);
            if (IsLink(new DirectoryInfo(current)))
            {
                return new(HostWorkspaceVerdictKind.Symlink);
            }
        }
        // Protect the top-level metadata subtree: writable ancestors could otherwise be renamed
        // to redirect an immutable gitfile around a read-only bind of just its final gitdir.
        var metadataRoot = Path.Combine(workspace, relative.Split(Path.DirectorySeparatorChar)[0]);
        return new(HostWorkspaceVerdictKind.Valid, workspace, metadataRoot);
    }

    static bool RootIsConfigured(string? root) => !string.IsNullOrWhiteSpace(root) && Path.IsPathFullyQualified(root) && Directory.Exists(root);

    static bool IsLink(FileSystemInfo entry) => entry.LinkTarget is not null || (entry.Exists && entry.Attributes.HasFlag(FileAttributes.ReparsePoint));

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
