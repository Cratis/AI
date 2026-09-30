// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Cratis.AI.Decisions.BuiltIn;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Cratis.AI.Decisions.BuiltIn.for_BuiltInDecisionEngineClient;

public class when_classifying_labels : Specification
{
    BuiltInDecisionEngineClient _client;
    BuiltInLabelClassification _result;
    HttpRequestMessage _request;
    JsonObject _body;

    void Establish()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(BuiltInDecisionEngineClient.HttpClientName).Returns(_ => new HttpClient(new Handler(this)));
        _client = new(factory, Substitute.For<ILogger<BuiltInDecisionEngineClient>>());
    }

    async Task Because() => _result = await _client.ClassifyLabels(
        DecisionContext.FromText("Build fails"),
        ["bug", "documentation"],
        new DecisionEngineConnection(DecisionEngineType.BuiltIn, "http://decision-engine", DecisionEngineApiKey.NotSet, "convaiinnovations/laya-multilingual"),
        0.6);

    [Fact] void should_use_the_labels_route() => _request.RequestUri!.ToString().ShouldEqual("http://decision-engine/v1/labels");
    [Fact] void should_send_each_candidate() => ((JsonArray)_body["labels"]!).Count.ShouldEqual(2);
    [Fact] void should_send_the_threshold() => _body["threshold"]!.GetValue<double>().ShouldEqual(0.6);
    [Fact] void should_return_all_label_probabilities() => _result.Probabilities["documentation"].ShouldEqual(0.1);
    [Fact] void should_return_selected_labels() => _result.Labels.Single().ShouldEqual("bug");

    sealed class Handler(when_classifying_labels context) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            context._request = request;
            context._body = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
            return new(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"labels":["bug"],"probabilities":{"bug":0.8,"documentation":0.1},"model":"convaiinnovations/laya-multilingual","latencyMs":5}""",
                    Encoding.UTF8,
                    "application/json"),
            };
        }
    }
}
