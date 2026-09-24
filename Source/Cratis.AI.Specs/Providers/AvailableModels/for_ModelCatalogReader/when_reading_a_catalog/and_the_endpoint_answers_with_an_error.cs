// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.AvailableModels.for_ModelCatalogReader.when_reading_a_catalog;

public class and_the_endpoint_answers_with_an_error : given.a_reader_with_a_stubbed_endpoint
{
    Exception _result;

    void Establish() => _statusCode = HttpStatusCode.Unauthorized;

    async Task Because() =>
        _result = await Cratis.Specifications.Catch.Exception(() => _reader.Read("https://api.anthropic.com/v1/models", []));

    [Fact] void should_report_the_discovery_failure() => _result.ShouldBeOfExactType<ModelCatalogUnavailable>();
}
