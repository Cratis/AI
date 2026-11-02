// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.AvailableModels.for_AnthropicModelListing.when_discovering;

public class and_the_alternate_catalog_request_fails : given.a_subscription_with_an_alternate_catalog_credential
{
    AIModelDiscoveryResult _result;

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    public async Task should_preserve_real_http_failures(HttpStatusCode status)
    {
        _statusCode = status;
        _requestFailure = null;
        _body = "{}";
        _result = await _models.Discover(_providerId);
        _result.Status.ShouldEqual(AIModelDiscoveryStatus.Failed);
        _result.Succeeded.ShouldBeFalse();
        _result.Failure.ShouldContain(((int)status).ToString());
        _result.Failure.ShouldContain("usage reporting catalog request failed");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task should_preserve_transport_and_timeout_failures(bool timeout)
    {
        _statusCode = HttpStatusCode.OK;
        _body = "{}";
        _requestFailure = timeout ? new OperationCanceledException("fixture timeout") : new HttpRequestException("fixture network failure");
        var result = await _models.Discover(_providerId);
        result.Status.ShouldEqual(AIModelDiscoveryStatus.Failed);
        result.Succeeded.ShouldBeFalse();
        result.Failure.ShouldContain("usage reporting catalog request failed");
    }
}
