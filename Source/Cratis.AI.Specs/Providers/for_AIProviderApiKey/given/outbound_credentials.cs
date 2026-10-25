// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.for_AIProviderApiKey.given;

public class outbound_credentials : Specification
{
    protected static readonly string[] Envelopes = ["enc:v1:secret-payload", "enc:v99:secret-payload"];
    protected IHttpClientFactory _http = null!;
    protected Exception?[] _errors = [];
    protected int _sent;

    void Establish()
    {
        _http = Substitute.For<IHttpClientFactory>();
        _http.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(new Handler(this)));
    }

    sealed class Handler(outbound_credentials context) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            context._sent++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") });
        }
    }
}
