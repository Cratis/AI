// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_building_the_container_specification;

public class and_host_prepared_metadata_is_an_internal_gitfile : for_HostWorkspace.given.a_workspace
{
    HostWorkspaceVerdict _verdict;
    CreateContainerParameters _result;
    string _metadata;

    void Establish()
    {
        Directory.Delete(Path.Combine(_workspace, ".git"));
        _metadata = Path.Combine(_workspace, ".metadata");
        Directory.CreateDirectory(Path.Combine(_metadata, "gitdir"));
        File.WriteAllText(Path.Combine(_workspace, ".git"), "gitdir: .metadata/gitdir\n");
    }

    void Because()
    {
        _verdict = HostWorkspace.Validate(_job, _root);
        _result = DockerWorkerRuntime.BuildContainerSpecification(_job, hostWorkspacePath: _verdict.Path, hostGitMetadataPath: _verdict.GitMetadataPath);
    }

    [Fact] void should_accept_an_internal_gitfile() => _verdict.Kind.ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_protect_the_metadata_ancestor_against_renaming() => _verdict.GitMetadataPath.ShouldEqual(_metadata);
    [Fact] void should_protect_both_the_gitfile_and_its_metadata_subtree() => _result.HostConfig.Binds.ShouldEqual<string>(
    [
        $"{_workspace}:/workspace:rw",
        $"{Path.Combine(_workspace, ".git")}:/workspace/.git:ro",
        $"{_metadata}:/workspace/.metadata:ro"
    ]);
}
