// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Configuring;
using Cratis.AI.Agents.Defining;
using Cratis.AI.Harnesses;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.Arc.Authorization;
using Cratis.Monads;

namespace Cratis.AI.Configuration.Seeding;

/// <summary>
/// Whether an agent has been configured for a purpose - read from the agent's own stream, so it
/// cannot be behind the way the listing read model can.
/// </summary>
/// <param name="Id">The agent's identity - one per purpose.</param>
/// <param name="Name">The agent's name - the projection needs a mapped value to hold an instance at all.</param>
[ReadModel]
[Authorize(Policy = AIManagementPolicy.Name)]
[Passive]
[FromEvent<AgentConfigured>]
[FromEvent<AgentRoleConfigured>]
public record SeededAgentPresence(AgentId Id, AgentName Name);

/// <summary>
/// Command for connecting a purpose to a seeded provider, only while the purpose has no agent.
/// </summary>
/// <remarks>
/// <see cref="ConfigureAgent"/> overwrites the agent, which would put back what an administrator
/// changed on every start. This one appends nothing once the purpose has an agent, so a restart is a
/// no-op and a run that stopped part way can be finished by the next one.
/// </remarks>
/// <param name="Purpose">The purpose to serve.</param>
/// <param name="Name">The agent's display name.</param>
/// <param name="Description">What the agent does, in a sentence.</param>
/// <param name="Tier">The capability tier the agent asks for.</param>
/// <param name="ProviderId">The provider the agent runs on.</param>
[Command]
[Authorize(Policy = AIManagementPolicy.Name)]
public record SeedAgent(LanguageModelPurpose Purpose, AgentName Name, AgentDescription Description, ModelTier Tier, AIProviderId ProviderId) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => AgentId.For(Purpose);

    /// <summary>
    /// Handles the command by appending an <see cref="AgentRoleConfigured"/> and an <see cref="AgentAssignedToProvider"/> event when the purpose has no agent yet.
    /// </summary>
    /// <param name="current">The agent presence so far - <see langword="null"/> when there is none.</param>
    /// <returns>The events - none when the purpose already has an agent.</returns>
    public Result<IEnumerable<object>, ValidationResult> Handle(SeededAgentPresence? current)
    {
        if (current is not null)
        {
            return Result<IEnumerable<object>, ValidationResult>.Success([]);
        }

        return Result<IEnumerable<object>, ValidationResult>.Success(
            [new AgentRoleConfigured(Purpose, Name, Description, Tier, Harness.Pi, Effort.High), new AgentAssignedToProvider(ProviderId)]);
    }
}

/// <summary>
/// Represents the validator for the <see cref="SeedAgent"/> command.
/// </summary>
public class SeedAgentValidator : CommandValidator<SeedAgent>
{
    readonly IReadModels _readModels;
    readonly IAgentProviderCompatibility _compatibility;

    /// <summary>
    /// Initializes a new instance of the <see cref="SeedAgentValidator"/> class.
    /// </summary>
    /// <param name="readModels">The configured providers.</param>
    /// <param name="compatibility">Checks provider capabilities against the agent purpose.</param>
    public SeedAgentValidator(IReadModels readModels, IAgentProviderCompatibility compatibility)
    {
        _readModels = readModels;
        _compatibility = compatibility;
        RuleFor(_ => _.Purpose).NotEqual(LanguageModelPurpose.NotSet).WithMessage("A purpose is required");
        RuleFor(_ => _.Name).NotEqual(AgentName.NotSet).WithMessage("A name is required");
        RuleFor(_ => _.ProviderId).NotEqual(AIProviderId.NotSet).WithMessage("A provider is required");
        RuleFor(_ => _)
            .CustomAsync(async (command, context, _) =>
            {
                var error = await AssignmentError(command);
                if (error is not null) context.AddFailure(error);
            });
    }

    async Task<string?> AssignmentError(SeedAgent command)
    {
        var provider = await _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)command.ProviderId);
        if (provider is null) return "The selected provider is unknown";
        return _compatibility.Supports(command.Purpose, provider.Type)
            ? null
            : "The selected provider does not satisfy the capabilities required by this agent";
    }
}
