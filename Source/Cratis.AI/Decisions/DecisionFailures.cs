// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Decisions;

/// <summary>
/// The exception that is thrown when a decision is asked for and no decision provider has been
/// configured to answer it.
/// </summary>
public sealed class DecisionProviderNotConfigured() : Exception(
    "No decision provider is configured - decisions cannot be made");

/// <summary>
/// The exception that is thrown when the configured decision provider does not advertise
/// <see cref="AIProviderCapability.Decision"/>.
/// </summary>
/// <param name="type">The provider type that was configured.</param>
/// <remarks>
/// This is the guard that stops a chat provider being pressed into decision duty by configuration
/// alone. It fires before any call is made, so the failure names the misconfiguration rather than
/// surfacing later as an unparseable vendor response.
/// </remarks>
public sealed class ProviderDoesNotSupportDecisions(AIProviderType type) : Exception(
    $"Provider type '{type}' does not support decision making");

/// <summary>
/// The exception that is thrown when a request cannot be answered as asked - no context to weigh
/// against, or no choices to weigh.
/// </summary>
/// <param name="reason">Why the request cannot be answered.</param>
/// <remarks>
/// Rejected rather than forwarded. A provider handed an empty context still returns a distribution,
/// and a caller reading it has no way to tell that the number in front of them means nothing.
/// </remarks>
public sealed class DecisionRequestIsNotAnswerable(string reason) : Exception(
    $"The decision request cannot be answered: {reason}");

/// <summary>
/// The exception that is thrown when a decision provider's response does not cover every choice it
/// was given.
/// </summary>
/// <param name="missing">The choices the provider left out.</param>
/// <remarks>
/// Treated as a contract violation rather than being silently completed with zeros. A missing
/// choice is indistinguishable from a choice the provider considered impossible, and the two want
/// very different responses from a caller.
/// </remarks>
public sealed class DecisionChoicesNotCovered(IEnumerable<DecisionChoiceId> missing) : Exception(
    $"The decision provider did not return a probability for: {string.Join(", ", missing.Select(_ => _.Value))}");
