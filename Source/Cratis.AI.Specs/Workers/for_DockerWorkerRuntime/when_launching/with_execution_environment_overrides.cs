// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_execution_environment_overrides : given.a_launch
{
    readonly List<Exception> _errors = [];

    async Task Because()
    {
        foreach (var name in (string[])["PATH", "path", "LD_PRELOAD", "ld_library_path", "Ld_AuDiT", "LD_FUTURE_OVERRIDE", "BASH_ENV", "env", "SHELLOPTS", "bashopts", "IFS", "ps4", "PROMPT_COMMAND", "glibc_tunables", "GCONV_PATH", "LOCPATH", "NLSPATH", "CDPATH", "BASH_COMPAT", "BASH_XTRACEFD", "DYLD_INSERT_LIBRARIES", "MALLOC_TRACE", "BASH_FUNC_test%%"])
        {
            _job = _job with { EnvironmentVariables = new Dictionary<string, string> { [name] = "untrusted" } };
            _errors.Add(await Catch.Exception(() => _runtime.Start(_client, _job)));
        }
    }

    [Fact] void should_reject_every_override_with_a_typed_error() => _errors.TrueForAll(error => error is DockerWorkerLaunchFailed).ShouldBeTrue();
    [Fact] void should_check_all_hostile_names() => _errors.Count.ShouldEqual(23);
    [Fact] void should_not_create_a_partial_container() => _client.Containers.DidNotReceive().CreateContainerAsync(Arg.Any<CreateContainerParameters>(), Arg.Any<CancellationToken>());
    [Fact] void should_not_start_a_container() => _client.Containers.DidNotReceive().StartContainerAsync(Arg.Any<string>(), Arg.Any<ContainerStartParameters>(), Arg.Any<CancellationToken>());
    [Fact] void should_not_need_container_cleanup() => _client.Containers.DidNotReceive().RemoveContainerAsync(Arg.Any<string>(), Arg.Any<ContainerRemoveParameters>(), Arg.Any<CancellationToken>());
    [Fact] void should_never_execute_a_command() => _commands.ShouldBeEmpty();
}
