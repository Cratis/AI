// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_releasing_for_use;

public class with_raw_credentials : Specification
{
    static readonly string[] _credentials = ["sk-ant-api-test", "sk-ant-oat01-test", "sk-openai-test", "gho_test", "", "{\"access\":\"test\"}"];
    string[] _released = [];

    void Because() => _released = [.. _credentials.Select(value => new AIProviderApiKey(value).ForUse())];

    [Fact] void should_preserve_raw_credentials_and_the_disconnected_sentinel() => _released.ShouldEqual(_credentials);
}
