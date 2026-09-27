// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Cratis.AI.Common;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Decisions.Jev;

/// <summary>
/// Weighs decisions with TypeSafe AI's Jev through its System One API.
/// </summary>
/// <param name="httpClientFactory">The <see cref="IHttpClientFactory"/>.</param>
/// <param name="logger">The logger.</param>
/// <remarks>
/// <para>
/// Every decision is put to Jev as a <c>choice</c> question: the caller's choices become the
/// criteria, their descriptions the criteria descriptions, and the question the instructions.
/// </para>
/// <para>
/// Requests that share a context are sent as several questions against one state in a single call.
/// Jev evaluates the questions of a request in parallel and bills per input token, so asking twenty
/// label questions about one issue costs about what asking one does - which is exactly the shape a
/// batch of per-label decisions has.
/// </para>
/// </remarks>
public class JevDecisionEngineClient(
    IHttpClientFactory httpClientFactory,
    ILogger<JevDecisionEngineClient> logger) : IDecisionEngineClient
{
    /// <summary>
    /// The name of the <see cref="HttpClient"/> this client is created from.
    /// </summary>
    public const string HttpClientName = "Cratis.AI.Decisions.Jev";

    const string DecideRoute = "v1/systemone";
    const string ModelsRoute = "v1/models";
    const string DefaultInstructions = "Which of the options best applies?";

    /// <inheritdoc/>
    public DecisionEngineType Type => DecisionEngineType.Jev;

    /// <inheritdoc/>
    public async Task<DecisionEngineAnswers> Decide(
        IReadOnlyList<DecisionRequest> requests,
        DecisionEngineConnection connection,
        CancellationToken cancellationToken = default)
    {
        using var client = CreateClient(connection);

        var distributions = new IReadOnlyList<DecisionOutcome>[requests.Count];
        var model = connection.Model;
        long inputTokens = 0;
        long outputTokens = 0;

        foreach (var group in requests.Select((request, index) => (Request: request, Index: index)).GroupBy(_ => StateFor(_.Request.Context)))
        {
            var members = group.ToList();
            var payload = new JevRequest(
                ModelFor(connection).Value,
                group.Key,
                members.ToDictionary(_ => QuestionId(_.Index), _ => QuestionFor(_.Request)));

            using var response = await Post(client, payload, cancellationToken);
            var body = await Read(response, cancellationToken);

            foreach (var (request, index) in members)
            {
                distributions[index] = DistributionFor(request, body, QuestionId(index));
            }

            if (!string.IsNullOrWhiteSpace(body.Model))
            {
                model = body.Model;
            }

            inputTokens += body.Usage?.InputTokens ?? 0;
            outputTokens += body.Usage?.OutputTokens ?? 0;
        }

        return new(distributions, model, inputTokens, outputTokens);
    }

    /// <inheritdoc/>
    public async Task<DecisionEngineProbe> Probe(DecisionEngineConnection connection, CancellationToken cancellationToken = default)
    {
        try
        {
            using var client = CreateClient(connection);
            using var response = await client.GetAsync(ModelsRoute, cancellationToken);

            return (int)response.StatusCode switch
            {
                >= 200 and < 300 => DecisionEngineProbe.Ready("Jev accepted the API key"),
                401 or 403 => DecisionEngineProbe.Unreachable("Jev did not accept the API key"),
                429 => DecisionEngineProbe.Unreachable("Jev is rate limiting this API key"),
                _ => DecisionEngineProbe.Unreachable($"Jev answered {(int)response.StatusCode}")
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or DecisionRequestIsNotAnswerable)
        {
            return DecisionEngineProbe.Unreachable("Jev could not be reached");
        }
    }

    /// <summary>
    /// Renders a context into the single state string Jev judges its questions against - structured
    /// pairs first, free text last, the same order the built-in engine uses.
    /// </summary>
    /// <param name="context">The context.</param>
    /// <returns>The state.</returns>
    internal static string StateFor(DecisionContext context)
    {
        var builder = new StringBuilder();
        foreach (var (key, value) in context.Structured ?? new Dictionary<string, string>())
        {
            builder.Append(key).Append(": ").AppendLine(value);
        }

        if (!string.IsNullOrWhiteSpace(context.Text))
        {
            builder.AppendLine(context.Text.Trim());
        }

        return builder.ToString().TrimEnd();
    }

    static string QuestionId(int index) => $"q{index}";

    static JevQuestion QuestionFor(DecisionRequest request) =>
        new(
            "choice",
            request.QuestionText ?? DefaultInstructions,
            request.Choices.ToDictionary(choice => choice.Value, request.DescriptionOf));

    static ModelName ModelFor(DecisionEngineConnection connection) =>
        string.IsNullOrWhiteSpace(connection.Model.Value) ? JevDefaults.Model : connection.Model;

    IReadOnlyList<DecisionOutcome> DistributionFor(DecisionRequest request, JevResponse body, string questionId)
    {
        if (body.Answers is null || !body.Answers.TryGetValue(questionId, out var answer) || answer.Probabilities is null)
        {
            logger.ChoiceCountMismatch(Type, 0, request.Choices.Count);
            throw new DecisionChoicesNotCovered(request.Choices);
        }

        return [.. answer.Probabilities.Select(entry => new DecisionOutcome(entry.Key, entry.Value))];
    }

    HttpClient CreateClient(DecisionEngineConnection connection)
    {
        if (string.IsNullOrWhiteSpace(connection.ApiKey.Value))
        {
            throw new DecisionRequestIsNotAnswerable("Jev has no API key configured");
        }

        var endpoint = string.IsNullOrWhiteSpace(connection.Endpoint.Value) ? JevDefaults.Endpoint.Value : connection.Endpoint.Value;
        var client = httpClientFactory.CreateClient(HttpClientName);
        client.BaseAddress = new Uri(endpoint.EndsWith('/') ? endpoint : endpoint + "/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", connection.ApiKey.Value);

        return client;
    }

    async Task<HttpResponseMessage> Post(HttpClient client, JevRequest payload, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await client.PostAsJsonAsync(DecideRoute, payload, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            logger.NetworkFailure(ex, Type);
            throw;
        }

        if (!response.IsSuccessStatusCode)
        {
            var statusCode = (int)response.StatusCode;
            logger.UnexpectedStatusCode(Type, statusCode);
            response.Dispose();
            throw new DecisionEngineRefusedTheRequest(Type, statusCode);
        }

        return response;
    }

    async Task<JevResponse> Read(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<JevResponse>(cancellationToken) ??
                   throw new DecisionEngineRefusedTheRequest(Type, (int)response.StatusCode);
        }
        catch (JsonException ex)
        {
            logger.UnreadableResponse(ex, Type);
            throw;
        }
    }
}
