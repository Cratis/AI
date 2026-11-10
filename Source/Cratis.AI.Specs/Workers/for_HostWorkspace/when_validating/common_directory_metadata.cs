// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_HostWorkspace.when_validating;

public class common_directory_metadata : given.a_workspace
{
    Dictionary<string, HostWorkspaceVerdictKind> _directory;
    Dictionary<string, HostWorkspaceVerdictKind> _gitfile;

    void Because()
    {
        _directory = ValidateLayout("directory", false);
        _gitfile = ValidateLayout("gitfile", true);
    }

    Dictionary<string, HostWorkspaceVerdictKind> ValidateLayout(string name, bool gitfile)
    {
        var workspace = Directory.CreateDirectory(Path.Combine(_root, name)).FullName;
        var gitDirectory = Directory.CreateDirectory(Path.Combine(workspace, gitfile ? ".metadata/gitdir" : ".git")).FullName;
        if (gitfile)
        {
            File.WriteAllText(Path.Combine(workspace, ".git"), "gitdir: .metadata/gitdir\n");
        }
        Directory.CreateDirectory(Path.Combine(workspace, "writable"));
        Directory.CreateDirectory(Path.Combine(gitDirectory, "shared"));
        Directory.CreateSymbolicLink(Path.Combine(gitDirectory, "linked"), Path.Combine(gitDirectory, "shared"));
        Directory.CreateSymbolicLink(Path.Combine(gitDirectory, "parent-link"), gitDirectory);
        var results = new Dictionary<string, HostWorkspaceVerdictKind>
        {
            ["absent"] = HostWorkspace.Validate(WithPath(workspace), _root).Kind,
            ["escape"] = ValidatePointer(workspace, gitDirectory, gitfile ? "../../writable" : "../writable"),
            ["inside"] = ValidatePointer(workspace, gitDirectory, "shared\n"),
            ["absolute"] = ValidatePointer(workspace, gitDirectory, Path.Combine(gitDirectory, "shared")),
            ["target-link"] = ValidatePointer(workspace, gitDirectory, "linked"),
            ["ancestor-link"] = ValidatePointer(workspace, gitDirectory, "parent-link/shared")
        };
        var entry = Path.Combine(gitDirectory, "commondir");
        File.Delete(entry);
        var pointer = Path.Combine(gitDirectory, "pointer");
        File.WriteAllText(pointer, "shared\n");
        File.CreateSymbolicLink(entry, pointer);
        results["entry-link"] = HostWorkspace.Validate(WithPath(workspace), _root).Kind;
        return results;
    }

    HostWorkspaceVerdictKind ValidatePointer(string workspace, string gitDirectory, string content)
    {
        File.WriteAllText(Path.Combine(gitDirectory, "commondir"), content);
        return HostWorkspace.Validate(WithPath(workspace), _root).Kind;
    }

    [Fact] void should_accept_directory_metadata_without_a_common_directory() => _directory["absent"].ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_accept_gitfile_metadata_without_a_common_directory() => _gitfile["absent"].ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_refuse_a_common_directory_escaping_dot_git() => _directory["escape"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_common_directory_escaping_internal_gitfile_metadata() => _gitfile["escape"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_accept_a_common_directory_inside_dot_git() => _directory["inside"].ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_accept_a_common_directory_inside_internal_gitfile_metadata() => _gitfile["inside"].ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_apply_the_relative_pointer_rule_to_dot_git_common_directories() => _directory["absolute"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_apply_the_relative_pointer_rule_to_internal_gitfile_common_directories() => _gitfile["absolute"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_common_directory_symlink_inside_dot_git() => _directory["target-link"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_common_directory_symlink_inside_internal_gitfile_metadata() => _gitfile["target-link"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_symlink_in_the_common_directory_path_inside_dot_git() => _directory["ancestor-link"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_symlink_in_the_common_directory_path_inside_internal_gitfile_metadata() => _gitfile["ancestor-link"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_symlinked_commondir_file_inside_dot_git() => _directory["entry-link"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_symlinked_commondir_file_inside_internal_gitfile_metadata() => _gitfile["entry-link"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
}
