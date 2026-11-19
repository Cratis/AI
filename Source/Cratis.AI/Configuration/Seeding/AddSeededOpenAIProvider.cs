// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Adding;
using Cratis.Arc.Authorization;
using Cratis.Monads;

namespace Cratis.AI.Configuration.Seeding;

/// <summary>
/// Command for adding the OpenAI provider a startup seed describes, under an identity derived from
/// the seed's name rather than a fresh one.
/// </summary>
/// <remarks>
/// <see cref="Providers.Adding.AddOpenAIProvider"/> opens a new provider stream on every call, which
/// is right for an administrator and wrong for a seed that runs on every start. Giving the provider a
/// stable identity lets the seed ask the provider's own stream - strongly consistent, and not a read
/// model that may be behind - whether it was already added. It appends the same
/// <see cref="OpenAIProviderAdded"/> event, so everything downstream treats it like any other provider,
/// and appends nothing when the provider exists, so it can neither duplicate a provider nor reset an
/// existing one's type or credentials - even called over HTTP by an authorized caller.
/// </remarks>
/// <param name="Id">The provider's identity, derived from the seed name.</param>
/// <param name="Name">The provider's display name.</param>
/// <param name="ApiKey">The API key, protected at rest by its type.</param>
[Command]
[Authorize(Policy = AIManagementPolicy.Name)]
public record AddSeededOpenAIProvider(AIProviderId Id, AIProviderName Name, AIProviderApiKey ApiKey) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => Id;

    /// <summary>
    /// Handles the command by appending an <see cref="OpenAIProviderAdded"/> event with no concurrency limit
    /// when the provider does not exist yet.
    /// </summary>
    /// <param name="current">The provider as configured so far - <see langword="null"/> when there is none.</param>
    /// <returns>The events - none when the provider already exists.</returns>
    public Result<IEnumerable<object>, ValidationResult> Handle(ConfiguredAIProvider? current)
    {
        if (current is not null)
        {
            return Result<IEnumerable<object>, ValidationResult>.Success([]);
        }

        return Result<IEnumerable<object>, ValidationResult>.Success([new OpenAIProviderAdded(Name, ApiKey, MaxConcurrentJobs.NotSet)]);
    }
}

/// <summary>
/// Represents the validator for the <see cref="AddSeededOpenAIProvider"/> command.
/// </summary>
public class AddSeededOpenAIProviderValidator : CommandValidator<AddSeededOpenAIProvider>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AddSeededOpenAIProviderValidator"/> class.
    /// </summary>
    public AddSeededOpenAIProviderValidator()
    {
        RuleFor(_ => _.Id).NotEqual(AIProviderId.NotSet).WithMessage("A provider identity is required");
        RuleFor(_ => _.Name).NotEqual(AIProviderName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ApiKey).NotEqual(AIProviderApiKey.NotSet).WithMessage("An API key is required");
    }
}
