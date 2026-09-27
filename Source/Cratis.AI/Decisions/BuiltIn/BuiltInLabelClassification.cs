// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Serialization;

namespace Cratis.AI.Decisions.BuiltIn;

/// <summary>A multi-label issue classification from the built-in Laya decision engine.</summary>
/// <param name="Labels">Candidate labels that met the supplied threshold.</param>
/// <param name="Probabilities">Independent yes probabilities for every candidate label.</param>
/// <param name="Model">The checkpoint used for inference.</param>
/// <param name="LatencyMs">Model request duration in milliseconds.</param>
public record BuiltInLabelClassification(
    [property: JsonPropertyName("labels")] IReadOnlyList<string> Labels,
    [property: JsonPropertyName("probabilities")] IReadOnlyDictionary<string, double> Probabilities,
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("latencyMs")] double LatencyMs);

/// <summary>Request to score each label independently rather than choosing only one.</summary>
/// <param name="Context">Issue context.</param>
/// <param name="Labels">Candidate labels.</param>
/// <param name="Threshold">Inclusive selection threshold.</param>
/// <param name="Descriptions">Optional label descriptions.</param>
public record BuiltInLabelRequest(
    [property: JsonPropertyName("context")] BuiltInDecisionContext Context,
    [property: JsonPropertyName("labels")] IReadOnlyList<string> Labels,
    [property: JsonPropertyName("threshold")] double Threshold,
    [property: JsonPropertyName("descriptions")] IReadOnlyDictionary<string, string>? Descriptions);
