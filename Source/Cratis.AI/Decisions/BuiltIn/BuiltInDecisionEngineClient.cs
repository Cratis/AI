// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Json;
using System.Text.Json;
using Cratis.AI.Common;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Decisions.BuiltIn;

/// <summary>
/// Speaks Decision API v1 to the platform's own Cratis Decision Engine
/// (<c>Source/DecisionEngine</c> in this repository).
/// </summary>
/// <param name="httpClientFactory">The <see cref="IHttpClientFactory"/>.</param>
/// <param name="logger">The logger.</param>
public class BuiltInDecisionEngineClient(
    IHttpClientFactory httpClientFactory,
    ILogger<BuiltInDecisionEngineClient> logger) : IDecisionEngineClient
{
    /// <summary>
    /// The name of the <see cref="HttpClient"/> this client is created from.
    /// </summary>
    public const string HttpClientName = "Cratis.AI.Decisions.BuiltIn";

    const string DecisionsRoute = "v1/decisions";
    const string BatchRoute = "v1/decisions/batch";
    const string LabelsRoute = "v1/labels";

    // /readyz rather than /healthz: a process that is up but has not loaded its model cannot answer
    // a decision, and reporting that as healthy on a settings page whose whole job is telling
    // someone whether this works would be a lie of exactly the wrong kind.
    const string ReadinessRoute = "readyz";

    /// <inheritdoc/>
    public DecisionEngineType Type => DecisionEngineType.BuiltIn;

    /// <inheritdoc/>
    public async Task<DecisionEngineAnswers> Decide(
        IReadOnlyList<DecisionRequest> requests,
        DecisionEngineConnection connection,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateClient(connection);

        if (requests.Count == 1)
        {
            using var single = await Post(client, DecisionsRoute, PayloadFor(requests[0]), cancellationToken);
            var body = await Read<BuiltInDecisionResponse>(single, cancellationToken);
            return new([OutcomesFrom(body)], ModelFrom(body, connection));
        }

        using var response = await Post(client, BatchRoute, new BuiltInDecisionBatchRequest([.. requests.Select(PayloadFor)]), cancellationToken);
        var batch = await Read<BuiltInDecisionBatchResponse>(response, cancellationToken);

        if (batch.Results.Count != requests.Count)
        {
            logger.DistributionCountMismatch(Type, batch.Results.Count, requests.Count);
            throw new DecisionChoicesNotCovered(requests.SelectMany(_ => _.Choices).Distinct());
        }

        return new([.. batch.Results.Select(OutcomesFrom)], batch.Results.Count > 0 ? ModelFrom(batch.Results[0], connection) : connection.Model);
    }

    /// <summary>
    /// Classifies an issue against caller-supplied labels. Unlike a choice decision, any number of
    /// labels may apply; every candidate receives an independent probability.
    /// </summary>
    /// <param name="context">Issue title, body and optional structured metadata.</param>
    /// <param name="labels">Distinct candidate labels.</param>
    /// <param name="connection">The built-in engine connection.</param>
    /// <param name="threshold">Inclusive probability threshold, between zero and one.</param>
    /// <param name="descriptions">Optional explanation of each label.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Selected labels and scores for every candidate.</returns>
    /// <exception cref="ArgumentException">The context, labels or threshold is invalid.</exception>
    public async Task<BuiltInLabelClassification> ClassifyLabels(
        DecisionContext context,
        IReadOnlyList<string> labels,
        DecisionEngineConnection connection,
        double threshold = 0.5,
        IReadOnlyDictionary<string, string>? descriptions = null,
        CancellationToken cancellationToken = default)
    {
        if (context.IsEmpty || labels.Count == 0 || labels.Any(string.IsNullOrWhiteSpace) ||
            labels.Distinct(StringComparer.Ordinal).Count() != labels.Count ||
            !double.IsFinite(threshold) || threshold is < 0 or > 1)
        {
            throw new ArgumentException("A nonempty context, distinct labels and a threshold in [0, 1] are required.");
        }

        using var client = CreateClient(connection);
        using var response = await Post(
            client,
            LabelsRoute,
            new BuiltInLabelRequest(new(context.Text, context.Structured), labels, threshold, descriptions),
            cancellationToken);
        return await Read<BuiltInLabelClassification>(response, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<DecisionEngineProbe> Probe(DecisionEngineConnection connection, CancellationToken cancellationToken = default)
    {
        try
        {
            using var client = CreateClient(connection);
            using var response = await client.GetAsync(ReadinessRoute, cancellationToken);

            return response.IsSuccessStatusCode
                ? DecisionEngineProbe.Ready("The built-in decision engine is ready")
                : DecisionEngineProbe.Unreachable($"The built-in decision engine answered {(int)response.StatusCode}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or DecisionRequestIsNotAnswerable)
        {
            return DecisionEngineProbe.Unreachable("The built-in decision engine could not be reached");
        }
    }

    static BuiltInDecisionRequest PayloadFor(DecisionRequest request) =>
        new(
            Guid.NewGuid().ToString("N"),
            new(request.Context.Text, request.Context.Structured),
            [.. request.Choices.Select(_ => _.Value)],
            request.QuestionText,
            DescriptionsFor(request));

    static Dictionary<string, string>? DescriptionsFor(DecisionRequest request)
    {
        var described = request.Choices
            .Select(choice => (Choice: choice.Value, Description: request.DescriptionOf(choice)))
            .Where(_ => _.Description is not null)
            .ToDictionary(_ => _.Choice, _ => _.Description!);

        return described.Count == 0 ? null : described;
    }

    static IReadOnlyList<DecisionOutcome> OutcomesFrom(BuiltInDecisionResponse response) =>
        [.. response.Choices.Select(entry => new DecisionOutcome(entry.Key, entry.Value))];

    static ModelName ModelFrom(BuiltInDecisionResponse response, DecisionEngineConnection connection) =>
        string.IsNullOrWhiteSpace(response.Model) ? connection.Model : new ModelName(response.Model);

    HttpClient CreateClient(DecisionEngineConnection connection)
    {
        var endpoint = connection.Endpoint.Value;
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            throw new DecisionRequestIsNotAnswerable("the built-in decision engine has no endpoint");
        }

        var client = httpClientFactory.CreateClient(HttpClientName);
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
            var statusCode = (int)response.StatusCode;
            response.Dispose();
            throw new DecisionEngineRefusedTheRequest(Type, statusCode);
        }

        return response;
    }

    async Task<T> Read<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(cancellationToken) ??
                   throw new DecisionEngineRefusedTheRequest(Type, (int)response.StatusCode);
        }
        catch (JsonException ex)
        {
            logger.UnreadableResponse(ex, Type);
            throw;
        }
    }
}
