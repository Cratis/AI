// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Harnesses;

namespace Cratis.AI.Providers.SettingHarnesses.for_SetAIProviderHarnesses;

public class when_setting_harnesses : Specification
{
    AIProviderHarnessesSet _result;

    void Because() => _result = new SetAIProviderHarnesses(AIProviderId.New(), [Harness.Claude, Harness.Pi]).Handle();

    [Fact] void should_record_the_whole_selection() => _result.SupportedHarnesses.ShouldContainOnly(Harness.Claude, Harness.Pi);
}
