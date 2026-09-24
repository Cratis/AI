// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_ModelCatalogReader.when_reading_a_catalog;

public class and_the_body_is_not_a_catalog : given.a_reader_with_a_stubbed_endpoint
{
    Exception _result;

    void Establish() => _body = "not json at all";

    async Task Because() =>
        _result = await Cratis.Specifications.Catch.Exception(() => _reader.Read("https://api.openai.com/v1/models", []));

    [Fact] void should_report_the_discovery_failure() => _result.ShouldBeOfExactType<ModelCatalogUnavailable>();
}
