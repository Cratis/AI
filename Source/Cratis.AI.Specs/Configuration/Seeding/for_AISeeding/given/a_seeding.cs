// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Arc.Authorization;
using Cratis.Execution;

namespace Cratis.AI.Configuration.Seeding.for_AISeeding.given;

public class a_seeding : Specification
{
    protected const string ApiKey = "sk-not-a-real-key";

    protected AISeeding _seeding;
    protected ICommandPipeline _commandPipeline;
    protected SeededOpenAIProvider _seed;
    protected List<object> _commands;

    void Establish()
    {
        _commands = [];
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _commandPipeline
            .Execute(Arg.Do<object>(_commands.Add))
            .Returns(CommandResult.Success(CorrelationId.New()));
        _seed = new(
            "OpenAI",
            ApiKey,
            [new SeededAgent("Greeting", "Greeter", "Answers the greeting.", ModelTier.Fast)],
            TierModels.NotSet with { Fast = "gpt-4.1-mini" });
        _seeding = new(_commandPipeline, Microsoft.Extensions.Logging.Abstractions.NullLogger<AISeeding>.Instance);
    }
}
