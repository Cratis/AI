// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Removing;

/// <summary>
/// Command for removing a configured AI provider. A pool member or an agent naming it as its
/// provider falls back the next time it resolves - nothing here reaches into either to clear the
/// reference. Ported from Direct's <c>AIProviders.Removing.RemoveAIProvider</c> (plan Section 5.2
/// step 4).
/// </summary>
/// <param name="Provider">The identity of the provider to remove.</param>
[Command]
public record RemoveAIProvider(AIProviderId Provider)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderRemoved"/> event.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, AIProviderRemoved) Handle() => (Provider, new());
}

/// <summary>
/// Event raised when a configured AI provider has been removed.
/// </summary>
[EventType]
public record AIProviderRemoved;
