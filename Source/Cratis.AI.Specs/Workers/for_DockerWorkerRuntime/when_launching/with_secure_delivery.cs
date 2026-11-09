// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_secure_delivery : given.a_launch
{
    Task Because() => Launch();

    [Fact] void should_start_before_verifying_the_mount_and_copying() => _operations.ShouldEqual(["start", "verify", "extract", "verify", "ready"]);
    [Fact] void should_report_started() => _outcome.ShouldEqual(WorkerLaunchOutcome.Started);
    [Fact] void should_not_fail() => _error.ShouldBeNull();
    [Fact] void should_check_tmpfs_before_delivery() => _commands[0].Cmd[2].ShouldContain("= tmpfs");
    [Fact] void should_verify_the_worker_can_read_private_files() => _commands[1].User.ShouldEqual("1655");
    [Fact] void should_verify_the_file_mode() => _commands[1].Cmd[2].ShouldContain("! -perm 0400");
    [Fact] void should_write_the_marker_as_the_worker() => _commands[^1].User.ShouldEqual("1655");
    [Fact] void should_use_the_shared_marker_path() => _commands[^1].Cmd[2].ShouldContain(WorkerSecrets.ReadyPath);
    [Fact] void should_not_put_secrets_in_exec_arguments() => string.Join(' ', _commands.SelectMany(command => command.Cmd)).ShouldNotContain("fixture-sensitive-value");
}
