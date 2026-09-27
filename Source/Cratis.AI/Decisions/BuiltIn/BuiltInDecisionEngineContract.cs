// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Serialization;

namespace Cratis.AI.Decisions.BuiltIn;

/// <summary>
/// The wire shape of a Decision API v1 request.
/// </summary>
/// <param name="RequestId">A correlation id echoed back in the response.</param>
/// <param name="Context">The context to weigh against.</param>
/// <param name="Choices">The choices to weigh.</param>
/// <param name="Question">The question the choices answer, when there is one.</param>
/// <param name="Descriptions">What each choice means, when the caller described them.</param>
/// <remarks>
/// The question and descriptions are optional on the wire: an engine that predates them ignores
/// them and weighs the bare choices exactly as it always did.
/// </remarks>
public record BuiltInDecisionRequest(
    [property: JsonPropertyName("requestId")] string RequestId,
    [property: JsonPropertyName("context")] BuiltInDecisionContext Context,
    [property: JsonPropertyName("choices")] IReadOnlyList<string> Choices,
    [property: JsonPropertyName("question"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Question,
    [property: JsonPropertyName("descriptions"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyDictionary<string, string>? Descriptions);

/// <summary>
/// The wire shape of the context half of a Decision API v1 request.
/// </summary>
/// <param name="Text">The free-text context.</param>
/// <param name="Structured">The structured context.</param>
public record BuiltInDecisionContext(
    [property: JsonPropertyName("text")] string? Text,
    [property: JsonPropertyName("structured")] IReadOnlyDictionary<string, string>? Structured);

/// <summary>
/// The wire shape of a Decision API v1 batch request.
/// </summary>
/// <param name="Decisions">The requests.</param>
public record BuiltInDecisionBatchRequest(
    [property: JsonPropertyName("decisions")] IReadOnlyList<BuiltInDecisionRequest> Decisions);

/// <summary>
/// The wire shape of a Decision API v1 response.
/// </summary>
/// <param name="RequestId">The correlation id from the request.</param>
/// <param name="Choices">The probability per choice.</param>
/// <param name="Model">The model that answered.</param>
/// <param name="Engine">The scoring engine that answered.</param>
/// <param name="LatencyMs">How long the engine took, in milliseconds.</param>
public record BuiltInDecisionResponse(
    [property: JsonPropertyName("requestId")] string RequestId,
    [property: JsonPropertyName("choices")] IReadOnlyDictionary<string, double> Choices,
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("engine")] string Engine,
    [property: JsonPropertyName("latencyMs")] double LatencyMs);

/// <summary>
/// The wire shape of a Decision API v1 batch response.
/// </summary>
/// <param name="Results">One response per request, in request order.</param>
public record BuiltInDecisionBatchResponse(
    [property: JsonPropertyName("results")] IReadOnlyList<BuiltInDecisionResponse> Results);
