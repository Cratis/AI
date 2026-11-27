// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Providers.OpenAI.for_TemperatureOmittingChatClient.when_sending_a_request;

public class and_the_options_have_no_temperature : given_a_recording_client
{
    void Establish() => _sent.Temperature = null;

    async Task Because()
    {
        using var client = TemperatureOmittingChatClient.ForOpenAI(_inner, "gpt-5");
        await client.GetResponseAsync([], _sent);
    }

    [Fact] void should_forward_the_same_options() => _received.ShouldBeSame(_sent);
}
