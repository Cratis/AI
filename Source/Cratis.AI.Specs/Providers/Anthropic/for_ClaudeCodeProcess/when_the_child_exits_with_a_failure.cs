// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeProcess;

public class when_the_child_exits_with_a_failure : Specification
{
    string _directory = null!;
    ClaudeCodeOutput _output = null!;

    void Establish() => _directory = Directory.CreateTempSubdirectory().FullName;

    async Task Because()
    {
        var info = ClaudeCodeCompletion.StartInfo(_directory, "not-a-real-token", "model", Effort.Low);
        info.FileName = "/bin/sh";
        info.ArgumentList.Clear();
        info.ArgumentList.Add("-c");
        info.ArgumentList.Add("cat; exit 7");
        _output = await new ClaudeCodeProcess().Run(info, "--a-prompt-is-not-an-option", CancellationToken.None);
    }

    [Fact] void should_preserve_the_childs_failure() => _output.ExitCode.ShouldEqual(7);
    [Fact] void should_send_the_prompt_through_standard_input() => _output.StandardOutput.ShouldEqual("--a-prompt-is-not-an-option");

    void Destroy() => Directory.Delete(_directory, recursive: true);
}
