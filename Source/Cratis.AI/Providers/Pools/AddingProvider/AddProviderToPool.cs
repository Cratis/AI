// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.AddingProvider;

/// <summary>
/// Command for adding a provider to a pool (#871) - the member names a provider and nothing else:
/// which model a completion runs on is decided by the acting agent's capability tier, translated
/// through the member provider's own tier mapping, so a pool stays a set of interchangeable
/// capacities rather than a grid of provider-and-model pairs.
/// </summary>
/// <param name="Pool">The pool to add to.</param>
/// <param name="Provider">The provider to add.</param>
[Command]
public record AddProviderToPool(AIProviderPoolId Pool, AIProviderId Provider) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    /// <remarks>
    /// Stated rather than inferred - the pool is what gains a provider; the provider travels in the event as a value. With two identity properties on the record,
    /// leaving it implicit makes the choice depend on declaration order.
    /// </remarks>
    public EventSourceId GetEventSourceId() => Pool;

    /// <summary>
    /// Handles the command by appending a <see cref="ProviderAddedToPool"/> event to the pool's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public ProviderAddedToPool Handle() => new(Provider);
}

/// <summary>
/// Represents the validator for the <see cref="AddProviderToPool"/> command.
/// </summary>
public class AddProviderToPoolValidator : CommandValidator<AddProviderToPool>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddProviderToPoolValidator"/> class.
    /// </summary>
    public AddProviderToPoolValidator()
    {
        RuleFor(_ => _.Pool).NotEqual(AIProviderPoolId.NotSet).WithMessage("A pool is required");
        RuleFor(_ => _.Provider).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
    }
}

/// <summary>
/// Event raised when a provider has been added to a pool.
/// </summary>
/// <remarks>
/// The per-member model this event used to carry is gone (#871) - the acting agent's capability
/// tier, translated through this provider's own mapping, decides the model. Evolved in place
/// rather than by generation, per this repository's event evolution policy: production was
/// repaired at rollout per <c>.agents/PROJECT.md</c>, with stored events rewritten to the
/// provider-only shape.
/// </remarks>
/// <param name="Provider">The provider that was added.</param>
[EventType]
public record ProviderAddedToPool(AIProviderId Provider);
