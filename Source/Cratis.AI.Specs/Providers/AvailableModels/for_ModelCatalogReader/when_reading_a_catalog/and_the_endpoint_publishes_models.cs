// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_ModelCatalogReader.when_reading_a_catalog;

public class and_the_endpoint_publishes_models : given.a_reader_with_a_stubbed_endpoint
{
    IEnumerable<ModelName> _result;

    void Establish() =>
        _body = """{"data":[{"id":"claude-sonnet-4-5"},{"id":""},{"id":"claude-haiku-4-5"}]}""";

    async Task Because() =>
        _result = await _reader.Read("https://api.anthropic.com/v1/models", [new("x-api-key", "sk-ant-test")]);

    [Fact] void should_list_every_model_with_an_id() => _result.ShouldContainOnly(new ModelName("claude-sonnet-4-5"), new ModelName("claude-haiku-4-5"));
    [Fact] void should_send_the_authentication_headers() => _request.Headers.GetValues("x-api-key").ShouldContainOnly("sk-ant-test");
}
