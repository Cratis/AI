// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamingProcess;

public class when_the_child_exits_unsuccessfully : Specification
{
    Exception? _error;
    readonly List<string> _lines = [];

    async Task Because()
    {
        var info = new ProcessStartInfo("/bin/sh") { RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        info.ArgumentList.Add("-c");
        info.ArgumentList.Add("cat >/dev/null; printf '%s\\n' '{\"type\":\"result\",\"subtype\":\"success\",\"result\":\"done\"}'; exit 1");
        _error = await Catch.Exception(async () =>
        {
            await foreach (var line in new ClaudeCodeStreamingProcess().Run(info, "prompt", CancellationToken.None)) _lines.Add(line);
        });
    }

    [Fact] void should_observe_the_success_shaped_result() => _lines.Count.ShouldEqual(1);
    [Fact] void should_still_fail_the_run() => _error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();
}
