// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Tenancy;
using Cratis.Chronicle;

namespace Cratis.AI.Providers.SigningIn;

/// <summary>
/// The explicit destination of a detached sign-in, independent of the originating request.
/// </summary>
/// <param name="EventStore">The configured event store.</param>
/// <param name="Tenant">The tenant captured while the request is available.</param>
internal sealed record SignInRecordingTarget(EventStoreName EventStore, TenantId Tenant)
{
    /// <summary>
    /// Gets the store using the same mapping as Arc's TenantNamespaceResolver.
    /// </summary>
    /// <param name="client">The long-lived Chronicle client.</param>
    /// <returns>The event store for the captured tenant.</returns>
    internal Task<IEventStore> GetEventStore(IChronicleClient client) =>
        client.GetEventStore(EventStore, Tenant.IsDefault ? EventStoreNamespaceName.Default : new EventStoreNamespaceName(Tenant.Value));
}
