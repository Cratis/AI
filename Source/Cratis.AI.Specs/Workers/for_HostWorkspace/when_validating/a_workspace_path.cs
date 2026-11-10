// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_HostWorkspace.when_validating;

public class a_workspace_path : given.a_workspace
{
    HostWorkspaceVerdict _result;
    Dictionary<string, HostWorkspaceVerdictKind> _rejections;
    string _leafLink;
    string _parentLink;
    string _fileLink;
    string _file;
    string _nested;
    string _outsideGitFile;
    string _gitLink;
    string _missingGit;

    void Establish()
    {
        _file = Path.Combine(_root, "file");
        File.WriteAllText(_file, "fixture");
        _leafLink = Path.Combine(_root, "leaf-link");
        Directory.CreateSymbolicLink(_leafLink, Path.GetPathRoot(_root)!);
        _parentLink = Path.Combine(_root, "parent-link");
        Directory.CreateSymbolicLink(_parentLink, _root);
        _fileLink = Path.Combine(_root, "file-link");
        File.CreateSymbolicLink(_fileLink, _file);
        _nested = Directory.CreateDirectory(Path.Combine(_workspace, "nested")).FullName;
        _outsideGitFile = Directory.CreateDirectory(Path.Combine(_root, "outside-gitfile")).FullName;
        File.WriteAllText(Path.Combine(_outsideGitFile, ".git"), $"gitdir: {Path.Combine(_workspace, ".git")}\n");
        _gitLink = Directory.CreateDirectory(Path.Combine(_root, "git-link")).FullName;
        Directory.CreateSymbolicLink(Path.Combine(_gitLink, ".git"), Path.Combine(_workspace, ".git"));
        _missingGit = Directory.CreateDirectory(Path.Combine(_root, "missing-git")).FullName;
    }

    void Because()
    {
        _result = HostWorkspace.Validate(_job, _root);
        _rejections = new()
        {
            ["unset-root"] = HostWorkspace.Validate(_job, null).Kind,
            ["empty-root"] = HostWorkspace.Validate(_job, string.Empty).Kind,
            ["relative-root"] = HostWorkspace.Validate(_job, "relative").Kind,
            ["missing-root"] = HostWorkspace.Validate(_job, Path.Combine(_root, "missing")).Kind,
            ["empty"] = Validate(string.Empty),
            ["relative"] = Validate("workspace"),
            ["parent"] = Validate(_workspace + "/../../etc"),
            ["dot"] = Validate(_root + "/./workspace"),
            ["empty-segment"] = Validate(_root + "//workspace"),
            ["trailing-separator"] = Validate(_workspace + "/"),
            ["bind-injection"] = Validate(_workspace + ":/etc:rw"),
            ["comma"] = Validate(_workspace + ",other"),
            ["newline"] = Validate(_workspace + "\nother"),
            ["nul"] = Validate(_workspace + "\0other"),
            ["filesystem-root"] = Validate(Path.GetPathRoot(_root)!),
            ["trusted-root"] = Validate(_root),
            ["sibling-prefix"] = Validate(_root + "-evil/workspace"),
            ["outside"] = Validate(Path.Combine(Path.GetDirectoryName(_root)!, "outside")),
            ["leaf-link"] = Validate(_leafLink),
            ["parent-link"] = Validate(Path.Combine(_parentLink, "workspace")),
            ["file-link"] = Validate(_fileLink),
            ["missing"] = Validate(Path.Combine(_root, "missing")),
            ["file"] = Validate(_file),
            ["nested"] = Validate(_nested),
            ["outside-gitfile"] = Validate(_outsideGitFile),
            ["git-link"] = Validate(_gitLink),
            ["missing-git"] = Validate(_missingGit)
        };
    }

    HostWorkspaceVerdictKind Validate(string path) => HostWorkspace.Validate(WithPath(path), _root).Kind;

    [Fact] void should_accept_the_prepared_directory() => _result.Kind.ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_return_the_exact_canonical_path() => _result.Path.ShouldEqual(_workspace);
    [Fact] void should_refuse_an_unset_root() => _rejections["unset-root"].ShouldEqual(HostWorkspaceVerdictKind.NotConfigured);
    [Fact] void should_refuse_an_empty_root() => _rejections["empty-root"].ShouldEqual(HostWorkspaceVerdictKind.NotConfigured);
    [Fact] void should_refuse_a_relative_root() => _rejections["relative-root"].ShouldEqual(HostWorkspaceVerdictKind.NotConfigured);
    [Fact] void should_refuse_a_nonexistent_root() => _rejections["missing-root"].ShouldEqual(HostWorkspaceVerdictKind.NotConfigured);
    [Fact] void should_refuse_an_empty_path() => _rejections["empty"].ShouldEqual(HostWorkspaceVerdictKind.PathMissing);
    [Fact] void should_refuse_a_relative_path() => _rejections["relative"].ShouldEqual(HostWorkspaceVerdictKind.NotAbsolute);
    [Fact] void should_refuse_parent_traversal() => _rejections["parent"].ShouldEqual(HostWorkspaceVerdictKind.Traversal);
    [Fact] void should_refuse_a_dot_segment() => _rejections["dot"].ShouldEqual(HostWorkspaceVerdictKind.Traversal);
    [Fact] void should_refuse_an_empty_segment() => _rejections["empty-segment"].ShouldEqual(HostWorkspaceVerdictKind.Traversal);
    [Fact] void should_refuse_a_trailing_separator() => _rejections["trailing-separator"].ShouldEqual(HostWorkspaceVerdictKind.Traversal);
    [Fact] void should_refuse_bind_string_injection() => _rejections["bind-injection"].ShouldEqual(HostWorkspaceVerdictKind.InvalidCharacters);
    [Fact] void should_refuse_a_comma() => _rejections["comma"].ShouldEqual(HostWorkspaceVerdictKind.InvalidCharacters);
    [Fact] void should_refuse_a_newline() => _rejections["newline"].ShouldEqual(HostWorkspaceVerdictKind.InvalidCharacters);
    [Fact] void should_refuse_nul() => _rejections["nul"].ShouldEqual(HostWorkspaceVerdictKind.InvalidCharacters);
    [Fact] void should_refuse_the_filesystem_root() => _rejections["filesystem-root"].ShouldEqual(HostWorkspaceVerdictKind.IsRoot);
    [Fact] void should_refuse_the_trusted_root_itself() => _rejections["trusted-root"].ShouldEqual(HostWorkspaceVerdictKind.IsRoot);
    [Fact] void should_refuse_a_sibling_with_the_same_prefix() => _rejections["sibling-prefix"].ShouldEqual(HostWorkspaceVerdictKind.OutsideRoot);
    [Fact] void should_refuse_an_outside_path() => _rejections["outside"].ShouldEqual(HostWorkspaceVerdictKind.OutsideRoot);
    [Fact] void should_refuse_an_outside_symlink_target() => _rejections["leaf-link"].ShouldEqual(HostWorkspaceVerdictKind.Symlink);
    [Fact] void should_refuse_a_middle_symlink_even_to_an_allowed_directory() => _rejections["parent-link"].ShouldEqual(HostWorkspaceVerdictKind.NestedPath);
    [Fact] void should_refuse_a_symlink_to_a_file() => _rejections["file-link"].ShouldEqual(HostWorkspaceVerdictKind.Symlink);
    [Fact] void should_refuse_a_missing_directory() => _rejections["missing"].ShouldEqual(HostWorkspaceVerdictKind.NotADirectory);
    [Fact] void should_refuse_a_file() => _rejections["file"].ShouldEqual(HostWorkspaceVerdictKind.NotADirectory);
    [Fact] void should_refuse_a_nested_workspace() => _rejections["nested"].ShouldEqual(HostWorkspaceVerdictKind.NestedPath);
    [Fact] void should_refuse_a_gitfile_pointing_outside_the_workspace() => _rejections["outside-gitfile"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
    [Fact] void should_refuse_a_git_metadata_symlink() => _rejections["git-link"].ShouldEqual(HostWorkspaceVerdictKind.Symlink);
    [Fact] void should_require_a_git_entry() => _rejections["missing-git"].ShouldEqual(HostWorkspaceVerdictKind.InvalidGitMetadata);
}
