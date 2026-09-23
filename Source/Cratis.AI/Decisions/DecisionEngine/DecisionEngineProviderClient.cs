// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Json;
using System.Text.Json;
using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Decisions.DecisionEngine;

/// <summary>
/// Talks Decision API v1 to a Cratis Decision Engine.
/// </summary>
/// <param name="httpClientFactory">The <see cref="IHttpClientFactory"/> the call is made through.</param>
/// <param name="logger">The logger.</param>
/// <remarks>
/// Nothing in here names a model family or a scoring strategy. The service reports both for
/// telemetry, and this client forwards neither into any decision the caller makes - swapping the
/// engine's model is a deployment concern that must never become a code change here.
/// </remarks>
public class DecisionEngineProviderClient(
    IHttpClientFactory httpClientFactory,
    ILogger<DecisionEngineProviderClient> logger) : IDecisionProviderClient
{
    /// <summary>
    /// The name of the <see cref="HttpClient"/> decision calls are made on.
    /// </summary>
    public const string HttpClientName = "Cratis.AI.Decisions.DecisionEngine";

    const string DecisionsRoute = "v1/decisions";
    const string BatchRoute = "v1/decisions/batch";

    /// <inheritdoc/>
    public AIProviderType Type => AIProviderType.DecisionEngine;

    /// <inheritdoc/>
    public async Task<IReadOnlyList<DecisionOutcome>> Decide(
        DecisionRequest request,
        ConfiguredAIProvider provider,
        ModelName model,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateClient(provider);
        var payload = PayloadFor(request);

        using var response = await Post(client, DecisionsRoute, payload, cancellationToken);
        var body = await Read<DecisionEngineResponse>(response, cancellationToken);

        return OutcomesFrom(body);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<IReadOnlyList<DecisionOutcome>>> Decide(
        IReadOnlyList<DecisionRequest> requests,
        ConfiguredAIProvider provider,
        ModelName model,
        CancellationToken cancellationToken = default)
    {
        if (requests.Count == 1)
        {
            return [await Decide(requests[0], provider, model, cancellationToken)];
        }

        using var client = CreateClient(provider);
        var payload = new DecisionEngineBatchRequest([.. requests.Select(PayloadFor)]);

        using var response = await Post(client, BatchRoute, payload, cancellationToken);
        var body = await Read<DecisionEngineBatchResponse>(response, cancellationToken);

        if (body.Results.Count != requests.Count)
        {
            logger.ChoiceCountMismatch(Type, body.Results.Count, requests.Count);
            throw new DecisionChoicesNotCovered(requests.SelectMany(_ => _.Choices).Distinct());
        }

        return [.. body.Results.Select(OutcomesFrom)];
    }

    static DecisionEngineRequest PayloadFor(DecisionRequest request) =>
        new(
            Guid.NewGuid().ToString("N"),
            new(request.Context.Text, request.Context.Structured),
            [.. request.Choices.Select(_ => _.Value)]);

    static IReadOnlyList<DecisionOutcome> OutcomesFrom(DecisionEngineResponse response) =>
        [.. response.Choices.Select(entry => new DecisionOutcome(entry.Key, entry.Value))];

    HttpClient CreateClient(ConfiguredAIProvider provider)
    {
        var client = httpClientFactory.CreateClient(HttpClientName);
        var endpoint = provider.Endpoint?.Value;
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            client.Dispose();
            throw new DecisionRequestIsNotAnswerable("the configured decision provider has no endpoint");
        }

        client.BaseAddress = new Uri(endpoint.EndsWith('/') ? endpoint : endpoint + "/");

        return client;
    }

    async Task<HttpResponseMessage> Post<T>(HttpClient client, string route, T payload, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await client.PostAsJsonAsync(route, payload, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            logger.NetworkFailure(ex, Type);
            throw;
        }

        if (!response.IsSuccessStatusCode)
        {
            logger.UnexpectedStatusCode(Type, (int)response.StatusCode);
            response.Dispose();
            throw new DecisionEngineRefusedTheRequest((int)response.StatusCode);
        }

        return response;
    }

    async Task<T> Read<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(cancellationToken) ??
                   throw new DecisionEngineRefusedTheRequest((int)response.StatusCode);
        }
        catch (JsonException ex)
        {
            logger.UnreadableResponse(ex, Type);
            throw;
        }
    }
}

/// <summary>
/// The exception that is thrown when a Decision Engine answers with a non-success status.
/// </summary>
/// <param name="statusCode">The status code returned.</param>
public sealed class DecisionEngineRefusedTheRequest(int statusCode) : Exception(
    $"The decision engine returned {statusCode}");
