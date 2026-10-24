// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_TemperatureOmittingChatClient.when_sending_a_request;

public class and_the_options_name_an_earlier_model : given_a_recording_client
{
    void Establish() => _sent.ModelId = "claude-sonnet-4-6";

    async Task Because() => await Send();

    [Fact] void should_keep_the_temperature() => _received!.Temperature.ShouldEqual(0.2f);
}
