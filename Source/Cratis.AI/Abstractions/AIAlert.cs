// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Abstractions;

/// <summary>
/// An operational signal the package raises for a condition a human should know about - a provider
/// exhausting its concurrency gate, a subscription token failing to refresh, a harness session that
/// never reported usage.
/// </summary>
/// <param name="Title">A short, human-readable summary.</param>
/// <param name="Detail">The detail - what happened, and any identifiers useful for investigating it.</param>
/// <param name="Severity">How urgent the alert is.</param>
public record AIAlert(string Title, string Detail, AIAlertSeverity Severity);
