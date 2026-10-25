// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.Capacity.for_ClaudeSubscriptionCapacity.when_reporting.given;

public class a_claude_subscription : Specification
{
    protected readonly List<HttpRequestMessage> _requests = [];
    protected readonly List<string> _bodies = [];
    protected readonly Dictionary<string, HttpResponseMessage> _answers = [];
    protected ClaudeSubscriptionCapacity _capacity = null!;
    protected AIProviderCapacityReport _report = null!;

    void Establish()
    {
        var http = Substitute.For<IHttpClientFactory>();
        http.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(new Handler(this)));
        _capacity = new(http, Options.Create(new AIProviderOptions()));
    }

    protected async Task Report() =>
        _report = await _capacity.Report(new ConfiguredAIProvider(Guid.NewGuid(), AIProviderType.Anthropic, "sk-ant-oat01-test"), CancellationToken.None);

    protected static HttpResponseMessage Answer(HttpStatusCode status, string body = "{}", params (string Name, string Value)[] headers)
    {
        var response = new HttpResponseMessage(status) { Content = new StringContent(body) };
        foreach (var (name, value) in headers)
        {
            response.Headers.TryAddWithoutValidation(name, value);
        }

        return response;
    }

    sealed class Handler(a_claude_subscription context) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            context._requests.Add(request);
            context._bodies.Add(request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken));
            return context._answers.TryGetValue(request.RequestUri!.ToString(), out var answer) ? answer : new HttpResponseMessage(HttpStatusCode.NotFound);
        }
    }
}
