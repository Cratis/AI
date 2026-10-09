// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeStreamingProcess;

public class when_not_enumerating : Specification
{
    Exception? _error;

    void Because() => _error = Catch.Exception(() => _ = new ClaudeCodeStreamingProcess().Run(new ProcessStartInfo("this-binary-does-not-exist"), "prompt", CancellationToken.None));

    [Fact] void should_not_start_a_child() => _error.ShouldBeNull();
}
