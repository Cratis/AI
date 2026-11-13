// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_a_reserved_secret : given.a_launch
{
    Exception _error;
    void Establish() => _job = _job with { Secrets = new Dictionary<string, string> { ["DIRECT_MEMORY_PATH"] = "synthetic-value" } };
    async Task Because() => _error = await Catch.Exception(() => _runtime.Start(_client, _job));
    [Fact] void should_explain_the_rejection() => _error.Message.ShouldContain("reserved for worker runtime configuration");
    [Fact] void should_refuse_before_container_creation() => _client.Containers.DidNotReceive().CreateContainerAsync(Arg.Any<CreateContainerParameters>(), Arg.Any<CancellationToken>());
    [Fact] void should_never_execute_a_command() => _commands.ShouldBeEmpty();
}
