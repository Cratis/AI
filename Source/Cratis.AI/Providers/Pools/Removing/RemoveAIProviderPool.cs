// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.Removing;

/// <summary>
/// Command for removing an AI provider pool. A role naming it falls back to the global default the
/// next time it runs - same posture as removing a provider a role names directly.
/// </summary>
/// <param name="Pool">The identity of the pool to remove.</param>
[Command]
public record RemoveAIProviderPool(AIProviderPoolId Pool)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderPoolRemoved"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AIProviderPoolRemoved Handle() => new();
}

/// <summary>
/// Event raised when an AI provider pool has been removed.
/// </summary>
[EventType]
public record AIProviderPoolRemoved;
