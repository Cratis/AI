// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.when_launching;

public class when_the_permission_scan_fails : given.a_launch
{
    int _exitCode;

    async Task Because()
    {
        await Launch();
        using var process = Process.Start(new ProcessStartInfo("bash")
        {
            ArgumentList =
            {
                "--noprofile", "--norc", "-c",
                "test() { return 0; }; find() { return 1; }; stat() { printf '1655:700'; }; " + _commands[1].Cmd[2]
            },
            UseShellExecute = false
        });
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await process!.WaitForExitAsync(deadline.Token);
        _exitCode = process.ExitCode;
    }

    [Fact] void should_not_treat_an_unreadable_scan_as_no_bad_files() => _exitCode.ShouldEqual(1);
}
