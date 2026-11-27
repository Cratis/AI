// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;

namespace Cratis.AI.Providers.OpenAI.for_TemperatureOmittingChatClient.when_sending_a_request;

public class and_the_options_name_a_reasoning_model : given_a_recording_client
{
    [Theory]
    [InlineData("o3")]
    [InlineData("gpt-5")]
    [InlineData("gpt-5-mini")]
    [InlineData("O1-preview")]
    [InlineData("o4-mini")]
    [InlineData("gpt-5.2")]
    async Task should_leave_out_the_temperature_without_changing_the_callers_options(string modelId)
    {
        using var client = TemperatureOmittingChatClient.ForOpenAI(_inner, "gpt-4o");
        _sent.ModelId = modelId;

        await client.GetResponseAsync([], _sent, TestContext.Current.CancellationToken);

        _received!.Temperature.ShouldBeNull();
        _sent.Temperature.ShouldEqual(0.2f);
    }
}
