// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_hardening_enabled : given.a_launch
{
    void Establish() => _options.DockerHardeningEnabled = true;
    Task Because() => Launch();

    [Fact] void should_never_run_privileged() => _client.Containers.Received().CreateContainerAsync(Arg.Is<CreateContainerParameters>(spec => !spec.HostConfig.Privileged), Arg.Any<CancellationToken>());
    [Fact] void should_drop_all_capabilities() => _client.Containers.Received().CreateContainerAsync(Arg.Is<CreateContainerParameters>(spec => spec.HostConfig.CapDrop.Count == 1 && spec.HostConfig.CapDrop[0] == "ALL"), Arg.Any<CancellationToken>());
    [Fact] void should_prevent_privilege_escalation() => _client.Containers.Received().CreateContainerAsync(Arg.Is<CreateContainerParameters>(spec => spec.HostConfig.SecurityOpt.Count == 1 && spec.HostConfig.SecurityOpt[0] == "no-new-privileges:true"), Arg.Any<CancellationToken>());
    [Fact] void should_deliver_secrets_without_a_root_exec() => _commands.TrueForAll(command => command.User == "1655").ShouldBeTrue();
}
