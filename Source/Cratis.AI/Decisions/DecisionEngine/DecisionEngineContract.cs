// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Serialization;

namespace Cratis.AI.Decisions.DecisionEngine;

/// <summary>
/// The wire shape of a Decision API v1 request.
/// </summary>
/// <param name="RequestId">A correlation id echoed back in the response.</param>
/// <param name="Context">The context to weigh against.</param>
/// <param name="Choices">The choices to weigh.</param>
public record DecisionEngineRequest(
    [property: JsonPropertyName("requestId")] string RequestId,
    [property: JsonPropertyName("context")] DecisionEngineContext Context,
    [property: JsonPropertyName("choices")] IReadOnlyList<string> Choices);

/// <summary>
/// The wire shape of the context half of a Decision API v1 request.
/// </summary>
/// <param name="Text">The free-text context.</param>
/// <param name="Structured">The structured context.</param>
public record DecisionEngineContext(
    [property: JsonPropertyName("text")] string? Text,
    [property: JsonPropertyName("structured")] IReadOnlyDictionary<string, string>? Structured);

/// <summary>
/// The wire shape of a Decision API v1 batch request.
/// </summary>
/// <param name="Decisions">The requests.</param>
public record DecisionEngineBatchRequest(
    [property: JsonPropertyName("decisions")] IReadOnlyList<DecisionEngineRequest> Decisions);

/// <summary>
/// The wire shape of a Decision API v1 response.
/// </summary>
/// <param name="RequestId">The correlation id from the request.</param>
/// <param name="Choices">Each choice with its normalized probability.</param>
/// <param name="Model">The model that produced the distribution.</param>
/// <param name="Engine">The scoring strategy that produced it.</param>
/// <param name="LatencyMs">How long the service itself took.</param>
public record DecisionEngineResponse(
    [property: JsonPropertyName("requestId")] string RequestId,
    [property: JsonPropertyName("choices")] IReadOnlyDictionary<string, double> Choices,
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("engine")] string Engine,
    [property: JsonPropertyName("latencyMs")] double LatencyMs);

/// <summary>
/// The wire shape of a Decision API v1 batch response.
/// </summary>
/// <param name="Results">One response per request, in the order the requests were supplied.</param>
public record DecisionEngineBatchResponse(
    [property: JsonPropertyName("results")] IReadOnlyList<DecisionEngineResponse> Results);
