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
[EventType(EventTypeId)]
public record AIProviderRemoved
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - chosen once, here, and
    /// never changed (decision 0002). Deliberately the bare type name as a string, not a fresh guid:
    /// this is exactly the id Direct's own pre-migration same-named type already resolves to
    /// implicitly (Chronicle's own type-name fallback, decision 0007) - matching it keeps Direct's
    /// real, already-stored provider events readable through this type once Direct's own duplicate
    /// is deleted, rather than orphaning them under an id nothing produces anymore.
    /// </summary>
    public const string EventTypeId = "AIProviderRemoved";
}
