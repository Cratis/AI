// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_ICanListAvailableModels;

public class when_adapting_a_legacy_listing : Specification
{
    readonly ConfiguredAIProvider _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "fixture-api-key");

    [Fact]
    async Task should_adapt_an_empty_success()
    {
        ICanListAvailableModels listing = new given.a_legacy_listing(() => Task.FromResult<IEnumerable<ModelName>>([]));
        var result = await listing.Discover(_provider);
        result.Status.ShouldEqual(AIModelDiscoveryStatus.Discovered);
        result.Succeeded.ShouldBeTrue();
        result.Models.ShouldBeEmpty();
    }

    [Fact]
    async Task should_adapt_only_a_catalog_failure()
    {
        ICanListAvailableModels listing = new given.a_legacy_listing(() => throw new ModelCatalogUnavailable("fixture", 403));
        var result = await listing.Discover(_provider);
        result.Status.ShouldEqual(AIModelDiscoveryStatus.Failed);
        result.Failure.ShouldContain("403");
    }

    [Fact]
    async Task should_not_hide_an_unexpected_implementation_error()
    {
        ICanListAvailableModels listing = new given.a_legacy_listing(() => throw new NotImplementedException("fixture bug"));
        var exception = await Cratis.Specifications.Catch.Exception(() => listing.Discover(_provider));
        exception.ShouldBeOfExactType<NotImplementedException>();
    }
}
