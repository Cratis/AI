// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_HostWorkspace.when_validating;

public class gitfile_metadata : given.a_workspace
{
    Dictionary<string, HostWorkspaceVerdictKind> _results;

    void Establish()
    {
        Directory.Delete(Path.Combine(_workspace, ".git"));
        Directory.CreateDirectory(Path.Combine(_workspace, ".metadata"));
        Directory.CreateSymbolicLink(Path.Combine(_workspace, "linked"), Path.Combine(_workspace, ".metadata"));
    }

    void Because()
    {
        _results = new()
        {
            ["internal"] = ValidateContent("gitdir: .metadata\n"),
            ["absolute"] = ValidateContent($"gitdir: {Path.Combine(_workspace, ".metadata")}"),
            ["malformed"] = ValidateContent("not a gitfile"),
            ["missing"] = ValidateContent("gitdir: missing"),
            ["symlink"] = ValidateContent("gitdir: linked"),
            ["traversal"] = ValidateContent("gitdir: linked/../.metadata"),
            ["extra-line"] = ValidateContent("gitdir: .metadata\nextra"),
            ["whitespace"] = ValidateContent("gitdir:  .metadata")
        };
    }

    HostWorkspaceVerdictKind ValidateContent(string content)
    {
        File.WriteAllText(Path.Combine(_workspace, ".git"), content);
        return HostWorkspace.Validate(_job, _root).Kind;
    }

    [Fact] void should_accept_an_internal_directory_target() => _results["internal"].ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_refuse_absolute_host_gitdirs_that_cannot_follow_container_path_remapping() => _results["absolute"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_reject_a_malformed_gitfile() => _results["malformed"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_reject_missing_metadata() => _results["missing"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_reject_a_symlinked_gitdir() => _results["symlink"].ShouldEqual(HostWorkspaceVerdictKind.Symlink);
    [Fact] void should_not_lexically_normalize_away_a_symlink_before_parent_traversal() => _results["traversal"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_reject_extra_gitfile_lines() => _results["extra-line"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_reject_ambiguous_gitdir_whitespace() => _results["whitespace"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
}
