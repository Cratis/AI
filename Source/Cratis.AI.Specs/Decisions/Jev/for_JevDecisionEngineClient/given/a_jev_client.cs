// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Cratis.AI.Decisions.Jev;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.Decisions.Jev.for_JevDecisionEngineClient.given;

public class a_jev_client : Specification
{
    protected List<(HttpRequestMessage Request, JsonObject Body)> _requests;
    protected Queue<string> _responses;
    protected JevDecisionEngineClient _client;
    protected DecisionEngineConnection _connection;

    void Establish()
    {
        _requests = [];
        _responses = new();
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(JevDecisionEngineClient.HttpClientName).Returns(_ => new HttpClient(new RecordingHandler(this)));
        _client = new(factory, Substitute.For<ILogger<JevDecisionEngineClient>>());
        _connection = new(DecisionEngineType.Jev, JevDefaults.Endpoint, "jv_live_key", JevDefaults.Model);
    }

    protected void JevAnswers(string json) => _responses.Enqueue(json);

    sealed class RecordingHandler(a_jev_client context) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? [] : (JsonNode.Parse(await request.Content.ReadAsStringAsync(cancellationToken)) as JsonObject ?? []);
            context._requests.Add((request, body));

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(context._responses.Dequeue(), Encoding.UTF8, "application/json")
            };
        }
    }
}
