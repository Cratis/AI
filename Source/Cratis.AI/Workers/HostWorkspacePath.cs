// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Checks workspace path syntax without accessing the filesystem.
/// </summary>
/// <param name="path">The requested workspace path.</param>
internal sealed class HostWorkspacePath(string? path)
{
    /// <summary>
    /// Rejects missing, unsafe, relative, or noncanonical paths.
    /// </summary>
    /// <returns>The first lexical error, or no error.</returns>
    internal HostWorkspaceVerdictKind? Validate()
    {
        if (string.IsNullOrEmpty(path))
        {
            return HostWorkspaceVerdictKind.PathMissing;
        }
        if (path.IndexOfAny(['\n', '\r', '\0', ':', ',']) >= 0)
        {
            return HostWorkspaceVerdictKind.InvalidCharacters;
        }
        return ValidateAbsolutePath();
    }

    HostWorkspaceVerdictKind? ValidateAbsolutePath()
    {
        if (!Path.IsPathFullyQualified(path))
        {
            return HostWorkspaceVerdictKind.NotAbsolute;
        }
        if (path == Path.GetPathRoot(path))
        {
            return HostWorkspaceVerdictKind.IsRoot;
        }
        return HasTraversal() ? HostWorkspaceVerdictKind.Traversal : null;
    }

    bool HasTraversal() => path![Path.GetPathRoot(path)!.Length..].Split(Path.DirectorySeparatorChar).Any(segment => segment.Length == 0 || string.Equals(segment, ".", StringComparison.Ordinal) || string.Equals(segment, "..", StringComparison.Ordinal));
}
