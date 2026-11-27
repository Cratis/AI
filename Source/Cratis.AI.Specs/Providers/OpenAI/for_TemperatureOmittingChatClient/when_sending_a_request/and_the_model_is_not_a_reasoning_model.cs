// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Providers.OpenAI.for_TemperatureOmittingChatClient.when_sending_a_request;

public class and_the_model_is_not_a_reasoning_model : given_a_recording_client
{
    async Task Because()
    {
        using var client = TemperatureOmittingChatClient.ForOpenAI(_inner, "gpt-4o");
        await client.GetResponseAsync([], _sent);
    }

    [Fact] void should_keep_the_temperature() => _received!.Temperature.ShouldEqual(0.2f);
}
