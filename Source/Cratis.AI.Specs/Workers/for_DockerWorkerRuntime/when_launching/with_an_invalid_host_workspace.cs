// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Microsoft.Extensions.Options;
using NullLogger = Microsoft.Extensions.Logging.Abstractions.NullLogger<Cratis.AI.Workers.DockerWorkerRuntime>;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_an_invalid_host_workspace : Specification
{
    WorkerLaunchOutcome _unsetRoot;
    WorkerLaunchOutcome _missingPath;
    WorkerLaunchOutcome _unknownMode;

    async Task Because()
    {
        var runtime = new DockerWorkerRuntime(Options.Create(new WorkerRuntimeOptions { DockerEndpoint = "http://127.0.0.1:1" }), NullLogger.Instance);
        var job = new WorkerJob(
            AgentSessionId.New(),
            "worker:latest",
            new Dictionary<string, string>
            {
                [HostWorkspace.ModeVariable] = HostWorkspace.ModeValue,
                [HostWorkspace.HostPathVariable] = "/missing/workspace"
            },
            new Dictionary<string, string>());
        _unsetRoot = await runtime.Start(job);
        var configured = new DockerWorkerRuntime(Options.Create(new WorkerRuntimeOptions { DockerEndpoint = "http://127.0.0.1:1", HostWorkspaceRoot = Path.GetTempPath() }), NullLogger.Instance);
        _missingPath = await configured.Start(job);
        _unknownMode = await runtime.Start(job with { EnvironmentVariables = new Dictionary<string, string> { [HostWorkspace.ModeVariable] = "unknown" } });
    }

    [Fact] void should_refuse_an_unconfigured_root_before_contacting_docker() => _unsetRoot.ShouldEqual(WorkerLaunchOutcome.InvalidWorkspace);
    [Fact] void should_refuse_an_invalid_path_before_contacting_docker() => _missingPath.ShouldEqual(WorkerLaunchOutcome.InvalidWorkspace);
    [Fact] void should_refuse_an_unknown_mode_before_contacting_docker() => _unknownMode.ShouldEqual(WorkerLaunchOutcome.InvalidWorkspace);
}
