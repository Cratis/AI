// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// The exception that is thrown when no decision engine is available - none is configured and the
/// deployment has no built-in engine to fall back to.
/// </summary>
public sealed class DecisionEngineNotAvailable() : Exception(
    "No decision engine is available - decisions cannot be made");

/// <summary>
/// The exception that is thrown when the configured decision engine has no client that can talk to it.
/// </summary>
/// <param name="type">The engine type that has no client.</param>
public sealed class NoClientForDecisionEngine(DecisionEngineType type) : Exception(
    $"There is no client for the '{type}' decision engine");

/// <summary>
/// The exception that is thrown when a decision request is malformed in a way no engine could answer.
/// </summary>
/// <param name="reason">Why the request is not answerable.</param>
public sealed class DecisionRequestIsNotAnswerable(string reason) : Exception(
    $"The decision request cannot be answered: {reason}");

/// <summary>
/// The exception that is thrown when a decision engine's response omits one or more of the choices
/// it was asked to weigh.
/// </summary>
/// <param name="missing">The choices the engine did not return a probability for.</param>
/// <remarks>
/// Deliberately not completed with zeros. "The engine considered this impossible" and "the engine
/// never looked at it" call for opposite responses from a caller.
/// </remarks>
public sealed class DecisionChoicesNotCovered(IEnumerable<DecisionChoiceId> missing) : Exception(
    $"The decision engine did not return a probability for: {string.Join(", ", missing.Select(_ => _.Value))}");

/// <summary>
/// The exception that is thrown when a decision engine refuses a request with a non-success status.
/// </summary>
/// <param name="type">The engine that refused.</param>
/// <param name="statusCode">The HTTP status code it answered with.</param>
public sealed class DecisionEngineRefusedTheRequest(DecisionEngineType type, int statusCode) : Exception(
    $"The {type} decision engine returned {statusCode}");
