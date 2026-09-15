// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Abstractions;

/// <summary>
/// The default <see cref="IAIAlerts"/> for a consumer that has not wired its own alerting system yet.
/// </summary>
public sealed class NoOpAIAlerts : IAIAlerts
{
    /// <inheritdoc/>
    public Task Raise(AIAlert alert) => Task.CompletedTask;
}
