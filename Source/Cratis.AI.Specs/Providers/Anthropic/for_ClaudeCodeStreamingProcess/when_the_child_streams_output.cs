// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamingProcess;

public class when_the_child_streams_output : Specification
{
    string _directory = null!;
    List<string> _lines = null!;

    void Establish() => _directory = Directory.CreateTempSubdirectory().FullName;

    async Task Because()
    {
        var info = ClaudeCodeChatClient.StartInfo(_directory, "not-a-real-token", "model", Effort.Low, null, null);
        info.FileName = "/bin/sh";
        info.ArgumentList.Clear();
        info.ArgumentList.Add("-c");
        info.ArgumentList.Add("cat >/dev/null; printf 'one\\ntwo\\nthree\\n'");

        _lines = [];
        await foreach (var line in new ClaudeCodeStreamingProcess().Run(info, "prompt", CancellationToken.None))
        {
            _lines.Add(line);
        }
    }

    [Fact] void should_yield_every_line_in_order() => _lines.ShouldEqual(["one", "two", "three"]);

    void Destroy() => Directory.Delete(_directory, recursive: true);
}
