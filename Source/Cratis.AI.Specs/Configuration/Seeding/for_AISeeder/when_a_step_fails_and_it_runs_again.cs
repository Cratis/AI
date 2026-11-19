// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Cratis.Execution;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.Seeding.for_AISeeder;

public class when_a_step_fails_and_it_runs_again : Specification
{
    bool _first;
    bool _second;

    async Task Because()
    {
        var pipeline = Substitute.For<ICommandPipeline>();
        pipeline.Execute(Arg.Any<object>()).Returns(CommandResult.Error(CorrelationId.New(), "refused"));
        var requests = new HttpRequestContextAccessor();
        var services = new ServiceCollection()
            .AddSingleton(pipeline)
            .AddSingleton<IHttpRequestContextAccessor>(requests)
            .AddSingleton<ISystemExecution>(new SystemExecution(new CurrentPrincipalAccessor(requests)))
            .AddLogging()
            .BuildServiceProvider();
        var seed = new SeededOpenAIProvider("OpenAI", "sk-not-a-real-key", [new SeededAgent("Greeting", "Greeter", "Answers.", ModelTier.Fast)]);
        var seeder = new AISeeder([seed], services.GetRequiredService<IServiceScopeFactory>(), TimeProvider.System, Microsoft.Extensions.Logging.Abstractions.NullLogger<AISeeder>.Instance);

        _first = await seeder.RunOnce();

        pipeline.Execute(Arg.Any<object>()).Returns(CommandResult.Success(CorrelationId.New()));
        _second = await seeder.RunOnce();
    }

    [Fact] void should_report_the_failed_run_as_incomplete_so_it_is_retried() => _first.ShouldBeFalse();
    [Fact] void should_report_the_later_run_as_complete() => _second.ShouldBeTrue();
}
