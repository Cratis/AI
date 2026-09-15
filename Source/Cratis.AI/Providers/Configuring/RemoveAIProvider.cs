// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Configuring;

/// <summary>
/// Command for removing a configured AI provider - vendor-agnostic. Ported from Studio's own
/// <c>Settings.AI.Providers.Removing.RemoveAIProvider</c>. Distinct from
/// <see cref="Removing.RemoveAIProvider"/> (Direct's shape, <c>Provider</c> rather than <c>Id</c>,
/// <see cref="Removing.AIProviderRemoved"/> rather than <see cref="AIModelRemoved"/>) for the same
/// reason the vendor Add/Reconfigure commands in this namespace are - see
/// <see cref="AnthropicModelConfigured"/>'s remarks.
/// </summary>
/// <param name="Id">The identifier of the provider to remove.</param>
[Command]
public record RemoveAIProvider(AIProviderId Id)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIModelRemoved"/> event.
    /// </summary>
    /// <returns>A tuple of the provider identity (event source) and the event.</returns>
    public (AIProviderId, AIModelRemoved) Handle() => (Id, new());
}

/// <summary>
/// Event raised when a configured AI provider has been removed, taking its credentials out of use.
/// Ported from Studio's own <c>Settings.AI.Providers.Removing.AIModelRemoved</c>.
/// </summary>
[EventType(EventTypeId)]
public record AIModelRemoved
{
    /// <summary>
    /// The pinned <see cref="EventTypeAttribute"/> id for this event type - the bare type name as a
    /// string, matching exactly what Studio's own pre-migration same-named type already resolves to
    /// implicitly (decisions 0007/0008), so Studio's real, already-stored removal events stay
    /// readable through this type once Studio's own duplicate is deleted.
    /// </summary>
    public const string EventTypeId = "AIModelRemoved";
}
