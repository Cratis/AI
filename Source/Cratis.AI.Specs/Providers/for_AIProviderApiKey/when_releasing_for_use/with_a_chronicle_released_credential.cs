// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_releasing_for_use;

public class with_a_chronicle_released_credential : Specification
{
    IReadModels _readModels = null!;
    ConfiguredAIProvider _stored = null!;
    string _released = string.Empty;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _stored = new(AIProviderId.New(), AIProviderType.Anthropic, "encrypted-at-rest");
        _readModels.Release(_stored).Returns(_stored with { ApiKey = "sk-ant-api-released" });
    }

    async Task Because() => _released = (await _readModels.Release(_stored)).ApiKey.ForUse();

    [Fact] void should_accept_the_plaintext_returned_by_chronicle_release() => _released.ShouldEqual("sk-ant-api-released");
}
