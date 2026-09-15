// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Renaming.for_RenameAIProvider;

public class when_handling : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly AIProviderName _newName = new("Renamed provider");

    (AIProviderId Id, AIProviderRenamed Event) _result;

    void Because() => _result = new RenameAIProvider(_providerId, _newName).Handle();

    [Fact] void should_append_on_the_providers_own_stream() => _result.Id.ShouldEqual(_providerId);
    [Fact] void should_carry_the_new_name() => _result.Event.Name.ShouldEqual(_newName);
}
