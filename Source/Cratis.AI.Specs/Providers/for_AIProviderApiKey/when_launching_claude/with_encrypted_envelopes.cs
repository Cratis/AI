// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_launching_claude;

public class with_encrypted_envelopes : Specification
{
    Exception?[] _errors = [];

    void Because() => _errors = [.. new[] { "enc:v1:secret", "enc:v99:secret" }.SelectMany(envelope => new[]
    {
        Catch.Exception(() => ClaudeCodeCompletion.StartInfo(Path.GetTempPath(), envelope, "model", Effort.Low)),
        Catch.Exception(() => ClaudeCodeChatClient.StartInfo(Path.GetTempPath(), envelope, "model", Effort.Low, null, null))
    })];

    [Fact] void should_refuse_before_a_process_can_receive_the_envelope() => _errors.All(error => error is AIProviderRequiresReconfiguration).ShouldBeTrue();
}
