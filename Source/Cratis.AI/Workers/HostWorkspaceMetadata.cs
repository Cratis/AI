// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Validates Git metadata that must remain inside read-only workspace mounts.
/// </summary>
/// <param name="workspace">The accepted workspace directory.</param>
internal sealed class HostWorkspaceMetadata(DirectoryInfo workspace)
{
    static bool IsInvalidCommonEntry(FileInfo entry)
    {
        if (HostWorkspace.IsLink(entry))
        {
            return true;
        }
        var directory = new DirectoryInfo(entry.FullName);
        return HostWorkspace.IsLink(directory) || Directory.Exists(entry.FullName);
    }

    static bool IsLink(string entry) => HostWorkspace.IsLink(new DirectoryInfo(entry)) || HostWorkspace.IsLink(new FileInfo(entry));

    static bool IsTrimmedTarget(string target) => !string.IsNullOrWhiteSpace(target) && target == target.Trim();

    static bool IsMappedTarget(string target) => !Path.IsPathFullyQualified(target) && target.IndexOfAny(['\n', '\r', '\0', ':', ',']) < 0;

    static bool IsRelativeTarget(string target)
    {
        if (!IsTrimmedTarget(target))
        {
            return false;
        }

        // Absolute host metadata names do not resolve under the container's /workspace remapping.
        if (!IsMappedTarget(target))
        {
            return false;
        }
        return !target.Split(Path.DirectorySeparatorChar).Any(segment => segment.Length == 0 || string.Equals(segment, ".", StringComparison.Ordinal) || string.Equals(segment, "..", StringComparison.Ordinal));
    }

    /// <summary>
    /// Resolves the metadata subtree to protect, rejecting unsafe entries.
    /// </summary>
    /// <returns>The accepted mount paths or a validation failure.</returns>
    internal HostWorkspaceVerdict Validate()
    {
        var entry = Path.Combine(workspace.FullName, ".git");
        if (IsLink(entry))
        {
            return new(HostWorkspaceVerdictKind.Symlink);
        }
        return Directory.Exists(entry) ? ValidateDirectory(new DirectoryInfo(entry)) : ValidateFile(new FileInfo(entry));
    }

    HostWorkspaceVerdict ValidateDirectory(DirectoryInfo entry) =>
        ValidateCommonDirectory(entry, entry, new(HostWorkspaceVerdictKind.Valid, workspace.FullName));

    HostWorkspaceVerdict ValidateFile(FileInfo entry)
    {
        if (!File.Exists(entry.FullName))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        try
        {
            return ValidateGitFile(File.ReadAllText(entry.FullName).TrimEnd('\r', '\n'));
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

    HostWorkspaceVerdict ValidateGitFile(string content)
    {
        const string prefix = "gitdir: ";
        if (!content.StartsWith(prefix, StringComparison.Ordinal))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        var directory = ResolveDirectory(workspace, content[prefix.Length..]);
        if (directory.Kind != HostWorkspaceVerdictKind.Valid)
        {
            return directory;
        }

        // Protect the top-level metadata subtree: writable ancestors could otherwise be renamed
        // to redirect an immutable gitfile around a read-only bind of just its final gitdir.
        var relative = Path.GetRelativePath(workspace.FullName, directory.Path!);
        var metadataRoot = new DirectoryInfo(Path.Combine(workspace.FullName, relative.Split(Path.DirectorySeparatorChar)[0]));
        return ValidateCommonDirectory(new DirectoryInfo(directory.Path!), metadataRoot, new(HostWorkspaceVerdictKind.Valid, workspace.FullName, metadataRoot.FullName));
    }

    HostWorkspaceVerdict ValidateCommonDirectory(DirectoryInfo gitDirectory, DirectoryInfo metadataRoot, HostWorkspaceVerdict accepted)
    {
        try
        {
            var entry = new FileInfo(Path.Combine(gitDirectory.FullName, "commondir"));
            if (IsInvalidCommonEntry(entry))
            {
                return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
            }
            if (!File.Exists(entry.FullName))
            {
                return accepted;
            }
            return ValidateCommonTarget(entry, gitDirectory, metadataRoot, accepted);
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

    HostWorkspaceVerdict ValidateCommonTarget(FileInfo entry, DirectoryInfo gitDirectory, DirectoryInfo metadataRoot, HostWorkspaceVerdict accepted)
    {
        var target = File.ReadAllText(entry.FullName).TrimEnd('\r', '\n');
        var directory = ResolveDirectory(gitDirectory, target);
        if (directory.Kind != HostWorkspaceVerdictKind.Valid)
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        return directory.Path!.StartsWith(metadataRoot.FullName + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            ? accepted
            : new(HostWorkspaceVerdictKind.InvalidGitMetadata);
    }

    HostWorkspaceVerdict ResolveDirectory(DirectoryInfo relativeTo, string target)
    {
        if (!IsRelativeTarget(target))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        var directory = Path.GetFullPath(target, relativeTo.FullName);
        if (!IsWorkspaceDirectory(directory))
        {
            return new(HostWorkspaceVerdictKind.InvalidGitMetadata);
        }
        var current = workspace.FullName;
        foreach (var segment in Path.GetRelativePath(workspace.FullName, directory).Split(Path.DirectorySeparatorChar))
        {
            current = Path.Combine(current, segment);
            if (HostWorkspace.IsLink(new DirectoryInfo(current)))
            {
                return new(HostWorkspaceVerdictKind.Symlink);
            }
        }
        return new(HostWorkspaceVerdictKind.Valid, directory);
    }

    bool IsWorkspaceDirectory(string directory) => directory.StartsWith(workspace.FullName + Path.DirectorySeparatorChar, StringComparison.Ordinal) && Directory.Exists(directory);
}
