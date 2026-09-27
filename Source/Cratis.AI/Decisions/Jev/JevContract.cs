// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Serialization;

namespace Cratis.AI.Decisions.Jev;

/// <summary>
/// The wire shape of a TypeSafe System One request.
/// </summary>
/// <param name="Model">The Jev model - an alias such as <c>jev-latest</c> or a pinned version.</param>
/// <param name="State">The state every question in the request is judged against.</param>
/// <param name="Questions">The questions, keyed by an identifier the model never sees.</param>
public record JevRequest(
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("questions")] IReadOnlyDictionary<string, JevQuestion> Questions);

/// <summary>
/// The wire shape of one System One question.
/// </summary>
/// <param name="Type">The question type - always <c>choice</c> here, since every decision picks one of a set.</param>
/// <param name="Instructions">The question itself, in full - the identifier it is keyed by is not shown to the model.</param>
/// <param name="Criteria">The options, each with a description or <see langword="null"/>.</param>
public record JevQuestion(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("instructions")] string Instructions,
    [property: JsonPropertyName("criteria")] IReadOnlyDictionary<string, string?> Criteria);

/// <summary>
/// The wire shape of a System One response.
/// </summary>
/// <param name="Model">The exact version that answered, even when an alias was asked for.</param>
/// <param name="Answers">One answer per question, keyed by the question's identifier.</param>
/// <param name="Usage">The tokens the request consumed.</param>
public record JevResponse(
    [property: JsonPropertyName("model")] string? Model,
    [property: JsonPropertyName("answers")] IReadOnlyDictionary<string, JevAnswer>? Answers,
    [property: JsonPropertyName("usage")] JevUsage? Usage);

/// <summary>
/// The wire shape of the answer to one choice question.
/// </summary>
/// <param name="Type">The question type the answer is for.</param>
/// <param name="Choice">The winning option.</param>
/// <param name="Confidence">How confident the model is, derived from the probabilities.</param>
/// <param name="Probabilities">The probability per option.</param>
public record JevAnswer(
    [property: JsonPropertyName("type")] string? Type,
    [property: JsonPropertyName("choice")] string? Choice,
    [property: JsonPropertyName("confidence")] double? Confidence,
    [property: JsonPropertyName("probabilities")] IReadOnlyDictionary<string, double>? Probabilities);

/// <summary>
/// The wire shape of the token usage a System One response reports.
/// </summary>
/// <param name="InputTokens">The input tokens - the only ones TypeSafe bills for.</param>
/// <param name="OutputTokens">The output tokens.</param>
public record JevUsage(
    [property: JsonPropertyName("input_tokens")] long InputTokens,
    [property: JsonPropertyName("output_tokens")] long OutputTokens);
