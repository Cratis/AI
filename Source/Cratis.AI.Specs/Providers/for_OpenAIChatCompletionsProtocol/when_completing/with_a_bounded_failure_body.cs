// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text;
using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.for_OpenAIChatCompletionsProtocol.when_completing;

public class with_a_bounded_failure_body : Specification
{
    HttpClient _client;
    Stream _stream;
    LanguageModelResult _result;

    void Establish()
    {
        _stream = Substitute.ForPartsOf<MemoryStream>(Encoding.UTF8.GetBytes("Gateway busy. " + new string(' ', 4000)));
        _client = new(new FailedResponse(_stream));
    }

    async Task Because() => _result = await OpenAIChatCompletionsProtocol.Complete(_client, new Uri("https://vendor.example/chat/completions"), "gpt-4", "prompt", Effort.Low, _ => { }, AIProviderType.OpenAI, AIProviderId.New(), Substitute.For<IAIProviderQuotaTracker>(), Substitute.For<ILogger>());

    void Destroy() => _client.Dispose();

    [Fact] void should_not_buffer_the_failed_response_before_reading_diagnostics() => _stream.ReceivedCalls().Count(call => call.GetMethodInfo().Name == nameof(Stream.ReadAsync) && call.GetArguments()[0] is Memory<byte> buffer && buffer.Length == 2048).ShouldEqual(1);
    [Fact] void should_name_the_model_and_http_status() => _result.FailureReason.ShouldContain("OpenAI model gpt-4 returned 429");
    [Fact] void should_retain_the_vendor_text() => _result.FailureReason.ShouldContain("Gateway busy.");
    [Fact] void should_still_be_transient() => _result.IsTransient.ShouldBeTrue();

    sealed class FailedResponse(Stream stream) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Content = new StreamContent(stream) });
    }
}
