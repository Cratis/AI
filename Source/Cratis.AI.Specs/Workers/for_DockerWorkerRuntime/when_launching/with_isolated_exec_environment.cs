// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_isolated_exec_environment : given.a_launch
{
    void Establish() => _job = _job with { EnvironmentVariables = new Dictionary<string, string> { ["UNCHANGED"] = "job-value" } };
    Task Because() => Launch();

    [Fact] void should_complete_delivery() => _error.ShouldBeNull();
    [Fact] void should_record_all_delivery_execs() => _commands.Count.ShouldEqual(5);
    [Fact] void should_only_set_the_fixed_path_for_every_identity() => _commands.TrueForAll(command => command.Env.SequenceEqual(["PATH=/usr/sbin:/usr/bin:/sbin:/bin"])).ShouldBeTrue();
    [Fact] void should_clear_inherited_environment_before_starting_the_absolute_shell() => _commands.TrueForAll(command => command.Cmd.Take(5).SequenceEqual(["/usr/bin/env", "-i", "PATH=/usr/sbin:/usr/bin:/sbin:/bin", "/bin/sh", "-c"])).ShouldBeTrue();
    [Fact] void should_not_forward_job_environment_to_exec() => _commands.SelectMany(command => command.Env).ShouldNotContain("UNCHANGED=job-value");
    [Fact] void should_use_absolute_stat_for_mount_verification() => _commands[0].Cmd[^1].ShouldContain("$(/usr/bin/stat -f -c %T");
    [Fact] void should_use_absolute_stat_for_payload_verification() => _commands[^2].Cmd[^1].ShouldContain("$(/usr/bin/stat -c %u:%a");
    [Fact] void should_use_absolute_find_for_payload_verification() => _commands[^2].Cmd[^1].ShouldContain("invalid=$(/usr/bin/find ");
    [Fact] void should_use_absolute_head_for_payload_writes() => _commands.Where(command => command.AttachStdin).All(command => command.Cmd[^1].Contains("/usr/bin/head -c ", StringComparison.Ordinal)).ShouldBeTrue();
    [Fact] void should_use_absolute_chmod_for_payload_writes() => _commands.Where(command => command.AttachStdin).All(command => command.Cmd[^1].Contains("/usr/bin/chmod 0400 ", StringComparison.Ordinal)).ShouldBeTrue();
    [Fact] void should_use_absolute_stat_for_write_verification() => _commands.Where(command => command.AttachStdin).All(command => command.Cmd[^1].Contains("$(/usr/bin/stat -c %s ", StringComparison.Ordinal)).ShouldBeTrue();
    [Fact] void should_use_absolute_chmod_for_root_publication() => _commands[^1].Cmd[^1].ShouldContain("/usr/bin/chmod 0444 ");
    [Fact] void should_use_absolute_mv_for_root_publication() => _commands[^1].Cmd[^1].ShouldContain("/usr/bin/mv ");
}
