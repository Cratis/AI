// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

public class with_a_host_prepared_job : given.a_launch
{
    DirectoryInfo _root;

    void Establish()
    {
        _root = Directory.CreateTempSubdirectory();
        _options.HostWorkspaceRoot = _root.FullName;
        var workspace = Directory.CreateDirectory(Path.Combine(_root.FullName, "workspace"));
        _job = _job with
        {
            EnvironmentVariables = new Dictionary<string, string>
            {
                [HostWorkspace.ModeVariable] = HostWorkspace.ModeValue,
                [HostWorkspace.HostPathVariable] = workspace.FullName
            }
        };
    }

    async Task Because() => _outcome = await Start();

    [Fact] void should_refuse_a_host_prepared_launch() => _outcome.ShouldEqual(WorkerLaunchOutcome.InvalidWorkspace);
    [Fact] void should_not_contact_the_cluster() => _factory.DidNotReceive().Create();
    [Fact] void should_not_create_a_secret() => _createdSecret.ShouldBeNull();
    [Fact] void should_not_create_a_job() => _createdJob.ShouldBeNull();

    void Destroy() => _root.Delete(true);
}
