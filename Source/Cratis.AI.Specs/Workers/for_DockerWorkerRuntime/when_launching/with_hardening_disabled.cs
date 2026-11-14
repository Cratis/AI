// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_hardening_disabled : given.a_launch
{
    Task Because() => Launch();

    [Fact] void should_default_to_opt_out() => _options.DockerHardeningEnabled.ShouldBeFalse();
    [Fact] void should_leave_capabilities_at_the_engine_default() => _client.Containers.Received().CreateContainerAsync(Arg.Is<CreateContainerParameters>(spec => spec.HostConfig.CapDrop == null), Arg.Any<CancellationToken>());
    [Fact] void should_not_add_the_privilege_escalation_restriction() => _client.Containers.Received().CreateContainerAsync(Arg.Is<CreateContainerParameters>(spec => spec.HostConfig.SecurityOpt == null), Arg.Any<CancellationToken>());
}
