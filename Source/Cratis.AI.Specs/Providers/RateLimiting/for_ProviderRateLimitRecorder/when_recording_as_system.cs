// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Providers.Capacity;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Microsoft.Extensions.Options;
using NullLogger = Microsoft.Extensions.Logging.Abstractions.NullLogger;

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimitRecorder;

public class when_recording_as_system : Specification
{
    CurrentPrincipalAccessor _accessor;
    ClaimsPrincipal? _during;
    ClaimsPrincipal? _after;
    ProviderRateLimitRecorder _recorder;

    void Establish()
    {
        var requests = Substitute.For<IHttpRequestContextAccessor>();
        requests.Current.Returns((IHttpRequestContext?)null);
        _accessor = new(requests);
        var pipeline = Substitute.For<ICommandPipeline>();
        pipeline.When(pipeline => pipeline.Execute(Arg.Any<object>())).Do(_ => _during = _accessor.Current);
        var capacities = Substitute.For<IAIProviderCapacities>();
        var now = DateTimeOffset.UtcNow;
        capacities.For(Arg.Any<AIProviderId>(), Arg.Any<CancellationToken>()).Returns(call =>
            AIProviderCapacityCalculator.Compute(call.Arg<AIProviderId>(), AIProviderCapacitySource.Subscription, [], null, now, null, now, 0.02));
        _recorder = new(capacities, pipeline, new SystemExecution(_accessor), TimeProvider.System, Options.Create(new AIProviderOptions()), NullLogger.Instance);
    }

    async Task Because()
    {
        await _recorder.Record(AIProviderId.New(), "Rate limit reached. Resets in 1 hour.");
        _after = _accessor.Current;
    }

    [Fact] void should_execute_with_system_authentication() => _during!.Identity!.AuthenticationType.ShouldEqual(SystemPrincipal.AuthenticationType);
    [Fact] void should_execute_with_the_system_subject() => _during!.FindFirst(ClaimTypes.NameIdentifier)!.Value.ShouldEqual(SystemPrincipal.Subject);
    [Fact] void should_restore_the_previous_principal() => _after.ShouldBeNull();
}
