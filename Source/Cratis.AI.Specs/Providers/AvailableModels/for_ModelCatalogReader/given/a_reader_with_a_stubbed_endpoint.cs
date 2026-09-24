// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.AvailableModels.for_ModelCatalogReader.given;

public class a_reader_with_a_stubbed_endpoint : Specification
{
    protected ModelCatalogReader _reader;
    protected HttpStatusCode _statusCode;
    protected string _body;
    protected HttpRequestMessage _request;

    void Establish()
    {
        _statusCode = HttpStatusCode.OK;
        _body = "{}";

        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(new StubHandler(this)));
        _reader = new(factory, Substitute.For<ILogger<ModelCatalogReader>>());
    }

    sealed class StubHandler(a_reader_with_a_stubbed_endpoint context) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            context._request = request;
            return Task.FromResult(new HttpResponseMessage(context._statusCode)
            {
                Content = new StringContent(context._body, Encoding.UTF8, "application/json")
            });
        }
    }
}
