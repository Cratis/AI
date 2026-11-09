// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using Docker.DotNet.Models;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class with_secure_delivery : given.a_launch
{
    Task Because() => Launch();

    [Fact] void should_start_then_verify_write_verify_and_commit() => _operations.ShouldEqual(["start", "verify", "write", "write", "verify", "ready"]);
    [Fact] void should_report_started() => _outcome.ShouldEqual(WorkerLaunchOutcome.Started);
    [Fact] void should_not_fail() => _error.ShouldBeNull();
    [Fact] void should_check_tmpfs_before_delivery() => _commands[0].Cmd[2].ShouldContain("= tmpfs");
    [Fact] void should_verify_as_the_worker() => _commands[^2].User.ShouldEqual("1655:1655");
    [Fact] void should_verify_the_file_mode() => _commands[^2].Cmd[2].ShouldContain("! -perm 0400");
    [Fact] void should_verify_the_group() => _commands[^2].Cmd[2].ShouldContain("! -group 1655");
    [Fact] void should_publish_as_root() => _commands[^1].User.ShouldEqual("0:0");
    [Fact] void should_use_the_root_owned_marker_path() => _commands[^1].Cmd[2].ShouldContain(WorkerSecrets.DockerReadyPath);
    [Fact] void should_not_put_secrets_in_exec_arguments() => string.Join(' ', _commands.SelectMany(command => command.Cmd)).ShouldNotContain("fixture-sensitive-value");
    [Fact] void should_send_secrets_only_over_stdin() => Encoding.UTF8.GetString(_streams[1].ToArray()).ShouldContain("fixture-sensitive-value");
    [Fact] void should_never_use_the_archive_api() => _client.Containers.DidNotReceive().ExtractArchiveToContainerAsync(Arg.Any<string>(), Arg.Any<CopyToContainerParameters>(), Arg.Any<Stream>(), Arg.Any<CancellationToken>());
    [Fact] void should_drain_every_exec_stream() => _streams.TrueForAll(stream => stream.Drained).ShouldBeTrue();
    [Fact] void should_dispose_every_exec_stream() => _streams.TrueForAll(stream => stream.Disposed).ShouldBeTrue();
    [Fact] void should_wait_for_running_and_null_exit_code_to_settle() => _inspections.Values.All(count => count == 3).ShouldBeTrue();
    [Fact] void should_require_a_non_writable_marker_mount() => _commands[0].Cmd[2].ShouldContain($"test ! -w {WorkerSecrets.DockerReadyDirectory}");
    [Fact] void should_set_private_file_permissions() => _commands[1].Cmd[2].ShouldContain("umask 077;");
    [Fact] void should_complete_all_checks_before_publication() => _verifiedBeforePublication.ShouldBeTrue();
    [Fact] void should_drain_before_inspecting() => _inspectedBeforeDrain.ShouldBeFalse();
}
