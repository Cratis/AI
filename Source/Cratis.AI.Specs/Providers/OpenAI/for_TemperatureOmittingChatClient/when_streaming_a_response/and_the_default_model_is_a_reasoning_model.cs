// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Providers.OpenAI.for_TemperatureOmittingChatClient.when_streaming_a_response;

public class and_the_default_model_is_a_reasoning_model : given_a_recording_client
{
    async Task Because()
    {
        using var client = TemperatureOmittingChatClient.ForOpenAI(_inner, "o3");
        await using var updates = client.GetStreamingResponseAsync([], _sent).GetAsyncEnumerator();
        await updates.MoveNextAsync();
    }

    [Fact] void should_leave_the_temperature_out() => _received!.Temperature.ShouldBeNull();
    [Fact] void should_not_change_the_callers_options() => _sent.Temperature.ShouldEqual(0.2f);
}
