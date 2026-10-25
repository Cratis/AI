// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamingProcess;

public class when_the_child_cannot_start : Specification
{
    string _directory = null!;
    Exception? _error;

    void Establish() => _directory = Directory.CreateTempSubdirectory().FullName;

    async Task Because()
    {
        var info = ClaudeCodeChatClient.StartInfo(_directory, "not-a-real-token", "model", Effort.Low, null, null);
        info.FileName = Path.Combine(_directory, "this-binary-does-not-exist");
        info.ArgumentList.Clear();

        _error = await Catch.Exception(async () =>
        {
            await foreach (var _ in new ClaudeCodeStreamingProcess().Run(info, "prompt", CancellationToken.None))
            {
            }
        });
    }

    [Fact] void should_report_a_friendly_failure() => _error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();

    void Destroy() => Directory.Delete(_directory, recursive: true);
}
