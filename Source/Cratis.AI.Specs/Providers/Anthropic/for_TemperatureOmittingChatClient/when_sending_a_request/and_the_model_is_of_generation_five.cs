// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_TemperatureOmittingChatClient.when_sending_a_request;

public class and_the_model_is_of_generation_five : given_a_recording_client
{
    async Task Because() => await Send();

    [Fact] void should_leave_the_temperature_out() => _received!.Temperature.ShouldBeNull();
    [Fact] void should_not_change_the_callers_options() => _sent.Temperature.ShouldEqual(0.2f);
}
